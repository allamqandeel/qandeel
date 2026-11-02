import { NotFoundException } from '@nestjs/common';
import { SpeechSynthesisFailure, type SpeechSynthesisRequest, type SpeechSynthesisSession, type SynthesizedChunk } from '../speech-synthesis.adapter';
import type { ListenSynthesisRoute } from '../listen/listen-synthesis.route';
import { WAV_HEADER_BYTES } from '../listen/wav';
import {
  LIVE_REPLY_FIRST_CONNECT_GRACE_MS, LiveReplyService, type AudioStreamSink, type LiveReplySink,
} from './live-reply.service';
import type { LiveReplyStore, LiveSegmentAttemptOutcome, StoredLiveReply } from './live-reply.store';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const TURN = '44444444-4444-4444-8444-444444444444';
const ASSISTANT = '55555555-5555-4555-8555-555555555555';
const SPEECH = { expression: 'CALM' as const, hints: [] };
const S0 = 'أهلًا بك، سعيد أنك كتبت لي اليوم.';
const S1 = 'كيف كان يومك في العمل؟';
const S2 = 'أخبرني بما حدث معك بالتفصيل.';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits (bounded) for a condition, so the order assertions do not depend on how loaded the machine is. */
async function until(condition: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition() && Date.now() < deadline) await tick(5);
  expect(condition()).toBe(true);
}

/** A segment's fake PCM: `parts` chunks of 4800 bytes (100 ms each), each byte = the segment's ordinal. */
type Plan = { parts?: number; delayMs?: number; fail?: SpeechSynthesisFailure; failAfter?: number };

class FakeRoute {
  calls: string[] = [];
  plans: Plan[] = [];
  private ordinal = 0;
  readonly admission = { enter: async () => () => undefined, recordFailure: () => undefined };
  readonly model = 'gemini-3.8-flash-tts';
  readonly voiceId = 'Achird';
  segmentTimeoutMs() { return 10_000; }
  retryDelayMs() { return 1; }
  readonly adapter = {
    provider: 'GEMINI' as const,
    supportsHints: true,
    synthesize: (request: SpeechSynthesisRequest): SpeechSynthesisSession => {
      this.calls.push(request.text);
      const plan = this.plans.shift() ?? {};
      const value = (this.ordinal += 1);
      let finish: (r: unknown) => void = () => undefined;
      let fail: (e: unknown) => void = () => undefined;
      const result = new Promise<never>((resolve, reject) => { finish = resolve as (r: unknown) => void; fail = reject; });
      const chunks = (async function* (): AsyncGenerator<SynthesizedChunk> {
        const parts = plan.parts ?? 3;
        for (let k = 0; k < parts; k += 1) {
          if (plan.fail && (plan.failAfter ?? 0) === k) {
            fail(plan.fail);
            throw plan.fail;
          }
          await tick(plan.delayMs ?? 2);
          yield { sequence: k, audio: Buffer.alloc(4800, value), contentType: 'audio/pcm' };
        }
        finish({ operation: 'GEMINI_SPEECH_GENERATION', voiceId: 'Achird', hintApplied: true, pcmSampleRate: 24000, usage: { completeness: 'COMPLETE', inputTokens: 10, audioOutputTokens: 20, source: 'PROVIDER_REPORTED' } });
      })();
      return { chunks, result } as unknown as SpeechSynthesisSession;
    },
  };
}

class FakeStore implements LiveReplyStore {
  owner = new Map<string, string>();
  admits: { index: number; callId: string }[] = [];
  retries: { index: number; callId: string }[] = [];
  settled = new Map<string, string>();
  segments = new Map<string, { callId: string; state: string; pcm?: Buffer }>();
  finished: Parameters<LiveReplyStore['finish']>[0] | null = null;
  private callSegment = new Map<string, string>();
  async open(input: { userId: string; replyId: string }) { this.owner.set(input.replyId, input.userId); return 'OPENED' as const; }
  async admitSegment(input: { userId: string; replyId: string; index: number; callId: string }) {
    this.admits.push({ index: input.index, callId: input.callId });
    const key = `${input.replyId}:${input.index}`;
    this.segments.set(key, { callId: input.callId, state: 'SYNTHESIZING' });
    this.callSegment.set(input.callId, key);
    return 'ADMITTED' as const;
  }
  async retrySegment(input: { replyId: string; index: number; callId: string }) {
    this.retries.push({ index: input.index, callId: input.callId });
    const key = `${input.replyId}:${input.index}`;
    this.segments.set(key, { callId: input.callId, state: 'SYNTHESIZING' });
    this.callSegment.set(input.callId, key);
    return 'RETRY_BEGUN' as const;
  }
  async completeSegment(input: { callId: string; pcm: Buffer }) {
    this.settled.set(input.callId, 'SUCCEEDED');
    const key = this.callSegment.get(input.callId)!;
    this.segments.set(key, { callId: input.callId, state: 'READY', pcm: input.pcm });
    return 'READY' as const;
  }
  async failSegment(input: { callId: string; outcome: LiveSegmentAttemptOutcome; final: boolean }) {
    this.settled.set(input.callId, input.outcome);
    return input.final ? 'FAILED' as const : 'RETRYABLE' as const;
  }
  async finish(input: Parameters<LiveReplyStore['finish']>[0]) { this.finished = input; }
  async read(userId: string, replyId: string): Promise<StoredLiveReply | null> {
    if (this.owner.get(replyId) !== userId) return null;
    const f = this.finished;
    return { state: f?.state ?? 'STREAMING', segmentCount: f?.segmentCount ?? null, audioMs: f?.audioMs ?? null, assistantTurnId: f?.assistantTurnId ?? null, segments: [] };
  }
  async readSegmentPcm(userId: string, replyId: string, index: number) {
    if (this.owner.get(replyId) !== userId) return null;
    return this.segments.get(`${replyId}:${index}`)?.pcm ?? null;
  }
}

class MemorySink implements AudioStreamSink {
  head: Buffer | null = null;
  body: Buffer[] = [];
  ended = false;
  firstWriteAt: number | null = null;
  private close: () => void = () => undefined;
  readonly closed = new Promise<void>((resolve) => { this.close = resolve; });
  header(bytes: Buffer) { this.head = bytes; }
  write(bytes: Buffer) { this.firstWriteAt ??= Date.now(); this.body.push(bytes); return true; }
  end() { this.ended = true; this.close(); }
  disconnect() { this.close(); }
  get pcm() { return Buffer.concat(this.body); }
}

function setup() {
  const route = new FakeRoute();
  const store = new FakeStore();
  const service = new LiveReplyService(store, route as unknown as ListenSynthesisRoute);
  return { route, store, service };
}

async function openReply(service: LiveReplyService): Promise<LiveReplySink> {
  const sink = await service.open(USER, SESSION, TURN);
  if (!sink) throw new Error('not opened');
  return sink;
}

describe('LiveReplyService (S8B-04 CP2, D-S3 + single stream)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('speaks released pieces in order through ONE stream that starts before the reply is complete, then announces the final length', async () => {
    const { route, store, service } = setup();
    const reply = await openReply(service);
    const listener = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, listener);
    reply.release(S0, SPEECH);
    await until(() => listener.pcm.length > 0); // audio before the reply is complete
    expect((await service.status(USER, reply.replyId)).audio.final).toBe(false);
    reply.release(` ${S1}`, SPEECH);
    reply.release(` ${S2}`, SPEECH);
    reply.end({ kind: 'COMPLETE', assistantTurnId: ASSISTANT });
    await streaming;
    expect(listener.head!.readUInt32LE(40)).toBe(0xffffffff); // length unknown while produced
    expect(route.calls).toHaveLength(3);
    expect(store.admits.map((a) => a.index)).toEqual([0, 1, 2]);
    // Order: every byte of segment k precedes segment k+1 (each fake segment is filled with its ordinal).
    const bytes = [...listener.pcm];
    expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
    const status = await service.status(USER, reply.replyId, 1000);
    expect(status).toEqual({ state: 'COMPLETE', audio: { final: true, durationMs: 300 * 3 }, assistantTurnId: ASSISTANT, text: `${S0} ${S1} ${S2}` });
    expect(store.finished).toMatchObject({ state: 'COMPLETE', segmentCount: 3, audioMs: 900, assistantTurnId: ASSISTANT });
  });

  it('a replay of a finished reply is the stored audio with a known length and starts no provider work', async () => {
    const { route, service } = setup();
    const reply = await openReply(service);
    const first = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, first);
    reply.release(S0, SPEECH);
    reply.end({ kind: 'COMPLETE', assistantTurnId: ASSISTANT });
    await streaming;
    const calls = route.calls.length;
    const again = new MemorySink();
    await service.stream(USER, reply.replyId, again);
    expect(route.calls.length).toBe(calls);
    expect(again.head!.readUInt32LE(40)).toBe(again.pcm.length);
    expect(again.pcm.equals(first.pcm)).toBe(true);
  });

  it('nothing paid starts when no phone connected within the grace; the text side still ends normally', async () => {
    const { route, store, service } = setup();
    const now = Date.now();
    const reply = await openReply(service);
    jest.spyOn(Date, 'now').mockReturnValue(now + LIVE_REPLY_FIRST_CONNECT_GRACE_MS + 1);
    reply.release(S0, SPEECH);
    reply.end({ kind: 'COMPLETE', assistantTurnId: ASSISTANT });
    await tick(10);
    expect(route.calls).toHaveLength(0);
    expect(store.admits).toHaveLength(0);
    expect(store.finished).toMatchObject({ state: 'COMPLETE', segmentCount: 0, audioMs: 0 });
  });

  it('cancel stops new synthesis at once; an attempt already running finishes and is kept', async () => {
    const { route, store, service } = setup();
    route.plans = [{ parts: 3, delayMs: 15 }, { parts: 3, delayMs: 15 }, {}, {}];
    const reply = await openReply(service);
    const listener = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, listener);
    reply.release(S0, SPEECH);
    reply.release(` ${S1}`, SPEECH);
    reply.release(` ${S2}`, SPEECH);
    await until(() => route.calls.length === 2); // the synthesizing bound: two running, the third waits
    await service.cancel(USER, reply.replyId);
    reply.end({ kind: 'COMPLETE', assistantTurnId: ASSISTANT });
    await streaming;
    await until(() => store.finished !== null);
    expect(route.calls.length).toBe(2); // the two running ones, never the third
    expect(reply.signal.aborted).toBe(true);
    expect(store.finished?.state).toBe('CANCELLED');
  });

  it('a known failure before any audio is retried once (its own ledger row); a failure after audio is never retried and ends the audio there', async () => {
    const { route, store, service } = setup();
    route.plans = [
      { parts: 2, fail: new SpeechSynthesisFailure('UNAVAILABLE', false, true), failAfter: 0 }, // S0 attempt 1: before audio
      { parts: 2 }, // S0 attempt 2
      { parts: 3, fail: new SpeechSynthesisFailure('INTERRUPTED', true, true), failAfter: 1 }, // S1: after audio
      { parts: 2 }, // S2 (may run in parallel, never spoken)
    ];
    const reply = await openReply(service);
    const listener = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, listener);
    reply.release(S0, SPEECH);
    await tick(20);
    reply.release(` ${S1}`, SPEECH);
    reply.release(` ${S2}`, SPEECH);
    reply.end({ kind: 'COMPLETE', assistantTurnId: ASSISTANT });
    await streaming;
    await service.status(USER, reply.replyId, 1000);
    expect(store.retries.map((r) => r.index)).toEqual([0]);
    const s1Calls = store.admits.filter((a) => a.index === 1).map((a) => a.callId);
    expect(s1Calls).toHaveLength(1);
    expect(store.settled.get(s1Calls[0]!)).toBe('UNKNOWN');
    expect(store.finished).toMatchObject({ state: 'COMPLETE', segmentCount: 1, audioMs: 200 });
    // The stream stopped at the failed segment's start of failure: S0's audio plus what S1 had already sent.
    expect(listener.ended).toBe(true);
  });

  it('a WITHHELD_TAIL end keeps what was released and spoken, and records it as such', async () => {
    const { store, service } = setup();
    const reply = await openReply(service);
    const listener = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, listener);
    reply.release(S0, SPEECH);
    reply.end({ kind: 'WITHHELD_TAIL', assistantTurnId: ASSISTANT });
    await streaming;
    await service.status(USER, reply.replyId, 1000);
    expect(store.finished).toMatchObject({ state: 'WITHHELD_TAIL', segmentCount: 1, assistantTurnId: ASSISTANT });
  });

  it("another human's reply does not exist for them: status, stream and cancel all answer NOT_FOUND", async () => {
    const { service } = setup();
    const reply = await openReply(service);
    await expect(service.status(OTHER, reply.replyId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.stream(OTHER, reply.replyId, new MemorySink())).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel(OTHER, reply.replyId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.status(USER, 'not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('without a synthesis route nothing opens (the reply stays text only)', async () => {
    const service = new LiveReplyService(new FakeStore());
    await expect(service.open(USER, SESSION, TURN)).resolves.toBeUndefined();
  });

  it('a header is a valid 24 kHz mono 16-bit WAV header', async () => {
    const { service } = setup();
    const reply = await openReply(service);
    const listener = new MemorySink();
    const streaming = service.stream(USER, reply.replyId, listener);
    reply.end({ kind: 'FAILED' });
    await streaming;
    const h = listener.head!;
    expect(h.length).toBe(WAV_HEADER_BYTES);
    expect(h.toString('ascii', 0, 4)).toBe('RIFF');
    expect(h.readUInt32LE(24)).toBe(24000);
    expect(h.readUInt16LE(22)).toBe(1);
    expect(h.readUInt16LE(34)).toBe(16);
  });

  it("the status carries the text released so far (even after the voice was stopped) and, once attached, the turn's answer", async () => {
    const { service } = setup();
    const reply = await openReply(service);
    reply.release(S0, SPEECH);
    expect((await service.status(USER, reply.replyId)).text).toBe(S0);
    await service.cancel(USER, reply.replyId);
    reply.release(` ${S1}`, SPEECH);
    expect((await service.status(USER, reply.replyId)).text).toBe(`${S0} ${S1}`);
    service.attachExchange(OTHER, reply.replyId, { stolen: true });
    expect((await service.status(USER, reply.replyId)).exchange).toBeUndefined();
    service.attachExchange(USER, reply.replyId, { done: true });
    expect((await service.status(USER, reply.replyId)).exchange).toEqual({ done: true });
  });

  it("a long-poll answers as soon as something is newer than what the phone has, and waits while nothing is", async () => {
    const { service } = setup();
    const reply = await openReply(service);
    const started = Date.now();
    const waiting = service.status(USER, reply.replyId, 5000, { textLength: 0, final: false, exchange: false });
    setTimeout(() => reply.release(S0, SPEECH), 30);
    expect((await waiting).text).toBe(S0);
    expect(Date.now() - started).toBeLessThan(2000);
    const idle = Date.now();
    await service.status(USER, reply.replyId, 150, { textLength: S0.length, final: false, exchange: false });
    expect(Date.now() - idle).toBeGreaterThanOrEqual(140);
  });
});
