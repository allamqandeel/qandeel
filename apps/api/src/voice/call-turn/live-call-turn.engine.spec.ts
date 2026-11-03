import { LiveCallConversationBinding, type LiveCallConversation, type LiveCallReplyOutcome, type LiveCallReplyRequest } from './live-call-conversation.port';
import { LiveCallTurnEngine, type CallTurnObservation } from './live-call-turn.engine';
import { InMemoryCallTurnStore } from './testing/in-memory-call-turn-store';
import { FakeCallSynthesis, fakeCallSynthesisRoute } from './testing/fake-call-synthesis';
import { FakeCallTurnChannel } from './testing/fake-call-turn-channel';
import { FAKE_CALL_INTERIM, FakeCallRecognizer, type FakeCallLine } from './testing/fake-call-recognizer';
import type { CallFailureLine } from './call-failure-line';
import type { LiveCallSpeechStream } from '../call/live-call-speech.port';

const FRAME = 640;
const loud = (): Buffer => {
  const pcm = Buffer.alloc(FRAME);
  for (let i = 0; i < FRAME / 2; i += 1) pcm.writeInt16LE(i % 2 === 0 ? 2_000 : -2_000, i * 2);
  return pcm;
};
const quiet = (): Buffer => Buffer.alloc(FRAME);
const REPLY = ['أهلًا، أنا معك.', 'قل لي أكثر.'];

async function until(condition: () => boolean, ms = 4_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('CONDITION_NOT_MET');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

function harness(script: Array<string | FakeCallLine>, options: {
  disposition?: 'ALLOW' | 'GUIDED' | 'BLOCK'; bind?: boolean; finalDelayMs?: number; conversation?: LiveCallConversation;
  failureLine?: CallFailureLine | null; store?: InMemoryCallTurnStore; epoch?: number;
} = {}) {
  const store = options.store ?? new InMemoryCallTurnStore();
  const binding = new LiveCallConversationBinding();
  const requests: LiveCallReplyRequest[] = [];
  const order: string[] = [];
  if (options.conversation) binding.bind(options.conversation);
  else if (options.bind !== false) {
    binding.bind({
      settleSafety: async (request) => {
        // S8B-05 CP4: a drained turn (never answered) or an inherited exchange has its Safety settled by the same gate.
        order.push(`settle:${request.callTurnIndex}`);
        await request.storeSafety(options.disposition ?? 'ALLOW');
      },
      reply: async (request): Promise<LiveCallReplyOutcome> => {
        requests.push(request);
        await request.storeSafety(options.disposition ?? 'ALLOW');
        order.push('safety');
        for (const piece of REPLY) {
          if (request.signal.aborted) return { kind: 'WITHHELD_TAIL', stages: {} };
          order.push('release');
          request.release(piece, { expression: 'CALM', hints: [] });
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return { kind: 'COMPLETE', stages: { first_release: 1 } };
      },
    });
  }
  const recognizer = new FakeCallRecognizer(script.map((line) => (typeof line === 'string' ? { text: line } : line)), { finalDelayMs: options.finalDelayMs ?? 5 });
  const engine = new LiveCallTurnEngine(store, binding, recognizer, fakeCallSynthesisRoute(new FakeCallSynthesis()), undefined, undefined, options.failureLine ?? null);
  const observed: CallTurnObservation[] = [];
  engine.observe((o) => observed.push(o));
  const channel = new FakeCallTurnChannel(undefined, undefined, undefined, options.epoch ?? 1);
  channel.userEndMs = 60_000;
  const stream: LiveCallSpeechStream = engine.open(channel);
  let clock = 0;
  /** `ms` of loud or quiet uplink at the call's clock, yielding to the event loop as a socket would. */
  const speak = async (kind: 'loud' | 'quiet', ms: number) => {
    for (let t = 0; t < ms; t += 20) {
      channel.captureMs = clock;
      stream.push(kind === 'loud' ? loud() : quiet(), clock);
      clock += 20;
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const playAll = async (callTurnIndex: number) => {
    const packets = channel.replyAudio.filter((p) => p.callTurnIndex === callTurnIndex);
    for (const p of packets) await stream.playout({ callTurnIndex, chunkSeq: p.chunkSeq, playedMs: (p.chunkSeq + 1) * 20 });
  };
  return { store, binding, requests, order, recognizer, engine, observed, channel, stream, speak, playAll };
}

describe('S8B-05 CP2 the call turn engine (§3 – §8): voice in, a committed turn, QANDEEL\'s reply heard', () => {
  it('a spoken turn: finals only, committed after the silence, answered, played out and recorded; the recognizer settled by the gateway bytes', async () => {
    const h = harness(['مرحبا يا قنديل']);
    await h.speak('loud', 600);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    expect(h.channel.of('TURN_COMMITTED')[0]).toMatchObject({ callTurnIndex: 1, role: 'USER', clientTurnId: null });
    expect(h.store.commits[0]).toMatchObject({ content: 'مرحبا يا قنديل', band: 'HIGH', anchorStartMs: 0, anchorEndMs: 600, epoch: 1 });
    // Partials never reach the conversation or the authority.
    expect(JSON.stringify(h.requests.map((r) => r.content)) + JSON.stringify(h.store.commits)).not.toContain(FAKE_CALL_INTERIM);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ content: 'مرحبا يا قنديل', callTurnIndex: 1, accessToken: 'token-a', sessionId: h.channel.sessionId });
    // S2: the Safety disposition is stored before anything is spoken.
    expect(h.store.calls.indexOf('storeSafety')).toBeLessThan(h.store.calls.indexOf('beginSpeech'));
    await until(() => h.store.calls.includes('finishGeneration'));
    await h.playAll(1);
    await until(() => h.channel.of('REPLY_END').length === 1);
    expect(h.channel.of('REPLY_END')[0]).toMatchObject({ callTurnIndex: 1, deliveryState: 'COMPLETE' });
    expect(h.store.exchanges[0]!.closed!.text).toBe(REPLY.join(''));
    const kinds = h.observed.map((o) => (o.kind === 'ENDPOINT' ? `ENDPOINT:${o.event}` : o.kind));
    expect(kinds.indexOf('ENDPOINT:FINALIZE')).toBeLessThan(kinds.indexOf('FINAL_ACCEPTED'));
    expect(kinds.indexOf('FINAL_ACCEPTED')).toBeLessThan(kinds.indexOf('COMMITTED'));
    expect(kinds).toContain('FIRST_AUDIO');

    h.stream.close();
    await until(() => [...h.store.ledger.values()].some((r) => r.kind === 'TRANSCRIPTION' && r.outcome !== 'PENDING'));
    const asr = [...h.store.ledger.values()].filter((r) => r.kind === 'TRANSCRIPTION');
    expect(asr).toEqual([{ kind: 'TRANSCRIPTION', callTurnIndex: null, outcome: 'SUCCEEDED', usage: { AUDIO_INPUT_MS: h.recognizer.sessions[0]!.bytes / 32 } }]);
  });

  it('speech resuming before the commit is the SAME turn: one commit, its finals in order', async () => {
    const h = harness(['أنا كنت', 'بفكر في الموضوع']);
    await h.speak('loud', 400);
    await h.speak('quiet', 600); // FINALIZE, no commit yet
    await h.speak('loud', 300); // resumed
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(h.store.commits).toHaveLength(1);
    expect(h.store.commits[0]!.content).toBe('أنا كنت بفكر في الموضوع');
    expect(h.recognizer.sessions[0]!.finalizes).toBe(2);
  });

  it('N1: a new turn while QANDEEL is still speaking closes the open exchange INTERRUPTED, with only what was heard', async () => {
    const h = harness(['احكيلي عن يومك', 'لحظة واحدة']);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.store.calls.includes('finishGeneration'));
    const first = h.channel.replyAudio.filter((p) => p.callTurnIndex === 1);
    await h.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 2);
    expect(h.channel.of('REPLY_END')[0]).toMatchObject({ callTurnIndex: 1, deliveryState: 'INTERRUPTED' });
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'INTERRUPTED', reason: 'NEXT_TURN' });
    expect(h.store.exchanges[0]!.closed!.heardMarkMs).toBeLessThan(first.length * 20);
    expect(h.channel.of('TURN_COMMITTED')[1]).toMatchObject({ callTurnIndex: 2 });
    // The interrupted reply's late confirmation changes nothing.
    expect(await h.stream.playout({ callTurnIndex: 1, chunkSeq: 1, playedMs: 40 })).toBe('IGNORED');
    h.stream.close();
  });

  it('noise and silence make no turn; a PLAYOUT for a reply this connection never sent is ignored', async () => {
    const h = harness(['x']);
    await h.speak('loud', 60);
    await h.speak('quiet', 1_200);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(h.store.commits).toEqual([]);
    expect(await h.stream.playout({ callTurnIndex: 4, chunkSeq: 0, playedMs: 20 })).toBe('IGNORED');
    h.stream.close();
  });

  it('without the conversation bound, the call records but no recognizer opens and no turn is taken', async () => {
    const h = harness(['x'], { bind: false });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    expect(h.recognizer.sessions).toEqual([]);
    expect(h.store.calls).toEqual([]);
    expect(await h.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 })).toBe('IGNORED');
  });

  // S3 regression (PR #375 review): the generation of turn 1 fails BEFORE its Safety is stored (its context read failed).
  // N1 must not close it without a stored Safety, and the next turn must be neither lost nor announced as committed: it is
  // held, whole, until S3 recomputes turn 1's Safety with the same gate over the same reader once the read is back.
  it('S3: a Safety never stored is recovered by the same gate before N1; the next turn is held, whole, until the context reads again', async () => {
    let readable = false;
    const settled: Array<{ callTurnIndex: number; content: string }> = [];
    const requests: LiveCallReplyRequest[] = [];
    // The gate's verdict for turn 1 over its fixed context: GUIDED, so a default ALLOW would be visible.
    const gate = (content: string): 'ALLOW' | 'GUIDED' => (content === 'احكيلي حاجة' ? 'GUIDED' : 'ALLOW');
    const h = harness(['احكيلي حاجة', 'أنا هنا', 'ولسه معاك'], {
      conversation: {
        reply: async (request): Promise<LiveCallReplyOutcome> => {
          requests.push(request);
          if (request.callTurnIndex === 1) return { kind: 'FAILED', stages: {} }; // the context read failed: nothing stored
          await request.storeSafety(gate(request.content));
          return { kind: 'FAILED', stages: {} };
        },
        settleSafety: async (request) => {
          settled.push({ callTurnIndex: request.callTurnIndex, content: request.content });
          if (!readable) throw new Error('CALL_CONTEXT_UNAVAILABLE');
          await request.storeSafety(gate(request.content));
        },
      },
    });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    // The reply failed and its own close tried S3 and could not: the exchange stays open, without a Safety.
    await until(() => settled.length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.store.exchanges[0]).toMatchObject({ index: 1, safety: null, closed: null, generation: 'FAILED' });
    expect(h.channel.of('REPLY_END')).toEqual([]);

    // Turn 2 is spoken: N1 cannot close turn 1 yet, so turn 2 is HELD, not committed, not announced.
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.observed.some((o) => o.kind === 'COMMIT_HELD'));
    expect(h.store.commits).toHaveLength(1);
    expect(h.channel.of('TURN_COMMITTED')).toHaveLength(1);
    // More words while held: the same held turn, nothing dropped.
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.observed.some((o) => o.kind === 'COMMIT_HELD' && o.finals === 2));
    expect(h.store.commits).toHaveLength(1);

    // The context reads again: S3 stores the gate's own verdict once, N1 closes turn 1 (FAILED), turn 2 commits whole.
    readable = true;
    await until(() => h.channel.of('TURN_COMMITTED').length === 2, 8_000);
    expect(h.store.commits).toHaveLength(2);
    expect(h.store.commits[1]!.content).toBe('أنا هنا ولسه معاك');
    expect(h.store.exchanges[0]).toMatchObject({ index: 1, safety: 'GUIDED' });
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'FAILED', reason: 'NEXT_TURN' });
    expect(h.channel.of('REPLY_END').filter((e) => e.callTurnIndex === 1)).toEqual([expect.objectContaining({ deliveryState: 'FAILED' })]);
    expect(h.channel.of('TURN_COMMITTED')[1]).toMatchObject({ callTurnIndex: 2, role: 'USER' });
    // Every recovery was of turn 1's own words, never a default; the stored value never changes on a repeat.
    expect(settled.every((s) => s.callTurnIndex === 1 && s.content === 'احكيلي حاجة')).toBe(true);
    expect(await h.store.storeSafety({ callTurnIndex: 1, disposition: 'GUIDED' })).toBe('SAME');
    await expect(h.store.storeSafety({ callTurnIndex: 1, disposition: 'ALLOW' })).rejects.toThrow('CALL_SAFETY_CONFLICT');
    expect(requests.map((r) => r.callTurnIndex)).toEqual([1, 2]);
    h.stream.close();
  });

  // S3 race (PR #375 review, head 7d585767): the context read comes back while the person is speaking again, before the
  // commit silence. The held turn must not be committed early, and QANDEEL must not start replying over the person: the
  // held words and the new ones are ONE turn, committed after the speech ends, by the usual commit rules.
  it('S3 race: a held turn is not committed while the person is speaking; it joins the new words after the commit silence', async () => {
    let readable = false;
    const requests: LiveCallReplyRequest[] = [];
    const h = harness(['احكيلي حاجة', 'أنا هنا', 'ولسه بكمل كلامي'], {
      conversation: {
        reply: async (request): Promise<LiveCallReplyOutcome> => {
          requests.push(request);
          if (request.callTurnIndex === 1) return { kind: 'FAILED', stages: {} };
          await request.storeSafety('ALLOW');
          return { kind: 'FAILED', stages: {} };
        },
        settleSafety: async (request) => {
          if (!readable) throw new Error('CALL_CONTEXT_UNAVAILABLE');
          await request.storeSafety('ALLOW');
        },
      },
    });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.observed.some((o) => o.kind === 'COMMIT_HELD' && o.finals === 1));

    // The person speaks again; the read comes back mid-speech. Five real seconds of speech outlast any retry delay (≤ 4 s).
    await h.speak('loud', 200);
    readable = true;
    for (let wall = Date.now(); Date.now() - wall < 5_000;) {
      await h.speak('loud', 100);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(h.channel.of('TURN_COMMITTED')).toHaveLength(1);
    expect(h.store.commits).toHaveLength(1);
    expect(requests.map((r) => r.callTurnIndex)).toEqual([1]);

    // The speech ends: after the usual silence, ONE turn with every word; only then is it answered.
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 2, 8_000);
    expect(h.store.commits).toHaveLength(2);
    expect(h.store.commits[1]!.content).toBe('أنا هنا ولسه بكمل كلامي');
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'FAILED', reason: 'NEXT_TURN' });
    await until(() => requests.length === 2);
    expect(requests[1]).toMatchObject({ callTurnIndex: 2, content: 'أنا هنا ولسه بكمل كلامي' });
    h.stream.close();
  }, 30_000);
});

describe('S8B-05 CP4 the call turn engine: barge-in, typed turns, drain, resume and F-01', () => {
  it('BARGE_IN stops QANDEEL at once; the echo before the onset is never the person\'s; N1 closes the reply INTERRUPTED, never FAILED', async () => {
    const h = harness(['احكيلي عن يومك', [
      { text: 'قل لي أكثر', startMs: 1_400, endMs: 1_480 }, // the reply's residual echo, before the onset
      { text: 'استنى لحظة', startMs: 1_500, endMs: 1_780 },
    ]]);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.replyAudio.some((p) => p.callTurnIndex === 1));
    expect(await h.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 })).toBe('APPLIED');
    await h.speak('loud', 100);
    const sent = h.channel.replyAudio.filter((p) => p.callTurnIndex === 1).length;
    expect(await h.stream.bargeIn({ callTurnIndex: 1, captureMs: 1_500 })).toBe('APPLIED');
    expect(h.store.exchanges[0]!.bargeInMs).toBe(1_500);
    // The one AbortController: the generation is stopped at once.
    expect(h.requests[0]!.signal.aborted).toBe(true);
    // A second onset for the same reply keeps the first.
    expect(await h.stream.bargeIn({ callTurnIndex: 1, captureMs: 1_520 })).toBe('APPLIED');
    expect(h.store.exchanges[0]!.bargeInMs).toBe(1_500);
    await h.speak('loud', 300);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 2);
    // No reply audio after the barge-in; the reply was never finished FAILED.
    expect(h.channel.replyAudio.filter((p) => p.callTurnIndex === 1).length).toBe(sent);
    expect(h.channel.of('REPLY_END').filter((e) => e.callTurnIndex === 1)).toEqual([expect.objectContaining({ deliveryState: 'INTERRUPTED' })]);
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'INTERRUPTED', reason: 'NEXT_TURN', heardMarkMs: 20 });
    // The person's words only, from the onset.
    expect(h.store.commits[1]).toMatchObject({ content: 'استنى لحظة', anchorStartMs: 1_500 });
    expect(h.observed.some((o) => o.kind === 'ECHO_EXCLUDED' && o.words === 1)).toBe(true);
    // Late (P3): the reply is closed; its BARGE_IN changes nothing.
    expect(await h.stream.bargeIn({ callTurnIndex: 1, captureMs: 1_600 })).toBe('IGNORED');
    expect(h.observed.some((o) => o.kind === 'LATE' && o.what === 'BARGE_IN')).toBe(true);
    h.stream.close();
  });

  it('without a barge-in nothing is excluded: words over QANDEEL\'s voice are the person\'s (no echo is assumed)', async () => {
    const h = harness(['احكيلي', { text: 'أنا هنا', startMs: 1_400, endMs: 1_480 }]);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.replyAudio.some((p) => p.callTurnIndex === 1));
    await h.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 });
    await h.speak('loud', 300);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 2);
    expect(h.store.commits[1]).toMatchObject({ content: 'أنا هنا', anchorStartMs: 1_400 });
    expect(h.observed.some((o) => o.kind === 'ECHO_EXCLUDED')).toBe(false);
    h.stream.close();
  });

  it('TEXT_TURN: QANDEEL stops, the typed turn commits once by its clientTurnId and is answered in text (TEXT_REPLIED)', async () => {
    const h = harness(['مرحبا']);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.replyAudio.some((p) => p.callTurnIndex === 1));
    await h.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 });
    const clientTurnId = '00000000-0000-4000-8000-0000000000e1';
    const [verdict, resend] = await Promise.all([
      h.stream.textTurn({ clientTurnId, text: 'كتبتلك رسالة' }), h.stream.textTurn({ clientTurnId, text: 'كتبتلك رسالة' }),
    ]);
    expect(verdict).toEqual({ kind: 'COMMITTED' });
    expect(resend).toEqual({ kind: 'COMMITTED' });
    expect(h.store.commits.filter((c) => c.channel === 'TEXT')).toEqual([
      expect.objectContaining({ commitId: clientTurnId, content: 'كتبتلك رسالة', band: null, anchorStartMs: null, anchorEndMs: null }),
    ]);
    expect(h.channel.of('TURN_COMMITTED')[1]).toMatchObject({ callTurnIndex: 2, role: 'USER', clientTurnId });
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'INTERRUPTED', reason: 'NEXT_TURN' });
    await until(() => h.channel.of('REPLY_END').some((e) => e.callTurnIndex === 2));
    expect(h.requests[1]).toMatchObject({ callTurnIndex: 2, channel: 'TEXT', content: 'كتبتلك رسالة' });
    expect(h.store.exchanges[1]!.closed).toMatchObject({ deliveryState: 'COMPLETE', reason: 'TEXT_REPLIED', text: REPLY.join('') });
    expect(h.channel.of('TURN_COMMITTED')[2]).toMatchObject({ callTurnIndex: 2, role: 'ASSISTANT', clientTurnId: null });
    expect(h.channel.of('REPLY_END').find((e) => e.callTurnIndex === 2)).toEqual({ type: 'REPLY_END', callTurnIndex: 2, chunks: 0, deliveryState: 'COMPLETE' });
    expect(h.channel.replyAudio.filter((p) => p.callTurnIndex === 2)).toEqual([]);
    // A typed exchange has no audio: a PLAYOUT for it is a violation. A resend after it settled still answers from the commit.
    expect(await h.stream.playout({ callTurnIndex: 2, chunkSeq: 0, playedMs: 20 })).toBe('VIOLATION');
    expect(await h.stream.textTurn({ clientTurnId, text: 'كتبتلك رسالة' })).toEqual({ kind: 'COMMITTED' });
    expect(h.store.commits.filter((c) => c.channel === 'TEXT')).toHaveLength(1);
    h.stream.close();
  });

  it('one order for speech and text: a typed turn waits behind a held spoken turn and commits after it', async () => {
    let readable = false;
    const h = harness(['احكيلي حاجة', 'أنا هنا'], {
      conversation: {
        reply: async (request): Promise<LiveCallReplyOutcome> => {
          if (request.callTurnIndex === 1) return { kind: 'FAILED', stages: {} };
          await request.storeSafety('ALLOW');
          return { kind: 'FAILED', stages: {} };
        },
        settleSafety: async (request) => {
          if (!readable) throw new Error('CALL_CONTEXT_UNAVAILABLE');
          await request.storeSafety('ALLOW');
        },
      },
    });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.observed.some((o) => o.kind === 'COMMIT_HELD'));
    const typed = h.stream.textTurn({ clientTurnId: '00000000-0000-4000-8000-0000000000e2', text: 'وكمان دي' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(h.store.commits).toHaveLength(1);
    readable = true;
    expect(await typed).toEqual({ kind: 'COMMITTED' });
    expect(h.store.commits.map((c) => [c.channel, c.content])).toEqual([['SPEECH', 'احكيلي حاجة'], ['SPEECH', 'أنا هنا'], ['TEXT', 'وكمان دي']]);
    expect(h.channel.of('TURN_COMMITTED').map((m) => m.callTurnIndex)).toEqual([1, 2, 3]);
    h.stream.close();
  }, 15_000);

  it('drain: the utterance in progress is committed, never answered, and its Safety stored; nothing is said over a lost call', async () => {
    const h = harness(['مرحبا', 'كنت بقول']);
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('TURN_COMMITTED').length === 1);
    await h.speak('loud', 300); // the connection goes while the person is speaking
    await h.stream.drain();
    expect(h.store.commits.map((c) => c.content)).toEqual(['مرحبا', 'كنت بقول']);
    expect(h.requests).toHaveLength(1);
    expect(h.store.exchanges[1]!.safety).toBe('ALLOW');
    expect(h.order).toContain('settle:2');
    expect(h.observed.some((o) => o.kind === 'DRAINED' && o.outcome === 'DRAINED' && o.waiting === 0)).toBe(true);
    // Drained: nothing more is taken on this connection; a typed turn is refused (the phone resends it after the resume).
    expect(await h.stream.textTurn({ clientTurnId: '00000000-0000-4000-8000-0000000000e3', text: 'x' })).toEqual({ kind: 'REFUSED', reason: 'UNAVAILABLE' });
    h.stream.close();
  });

  it('resume (P5): the next connection settles the open exchange it inherits before its first commit, and applies a resent PLAYOUT', async () => {
    const first = harness(['مرحبا', 'كنت بقول']);
    await first.speak('loud', 400);
    await first.speak('quiet', 1_000);
    await until(() => first.channel.replyAudio.some((p) => p.callTurnIndex === 1));
    first.stream.close();
    first.store.exchanges[0]!.safety = null; // as if the generation never stored it before the connection went
    first.store.epoch = 2;
    const second = harness(['أنا رجعت'], { store: first.store, epoch: 2 });
    // The phone resends its unconfirmed mark for the older connection's reply: applied while the exchange is open.
    expect(await second.stream.playout({ callTurnIndex: 1, chunkSeq: 0, playedMs: 20 })).toBe('APPLIED');
    await second.speak('loud', 400);
    await second.speak('quiet', 1_000);
    await until(() => second.channel.of('TURN_COMMITTED').length === 1);
    expect(second.order.indexOf('settle:1')).toBeGreaterThanOrEqual(0);
    expect(second.store.exchanges[0]!.closed).toMatchObject({ reason: 'NEXT_TURN' });
    expect(second.store.exchanges[0]!.safety).toBe('ALLOW');
    expect(second.channel.of('TURN_COMMITTED')[0]).toMatchObject({ callTurnIndex: 2 });
    second.stream.close();
  });

  it('F-01: a reply that produced nothing plays the fixed line (heard on the QANDEEL track, not as reply speech) and closes FAILED', async () => {
    const line: CallFailureLine = { ar: [Buffer.from([1]), Buffer.from([2]), Buffer.from([3])], en: [Buffer.from([4])] };
    const failing: LiveCallConversation = {
      reply: async (request) => {
        await request.storeSafety('ALLOW');
        return { kind: 'FAILED', stages: {} };
      },
      settleSafety: async () => undefined,
    };
    const h = harness(['مرحبا'], { conversation: failing, failureLine: line });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('REPLY_END').length === 1);
    expect(h.channel.replyAudio.map((p) => [p.callTurnIndex, p.chunkSeq, p.offsetMs])).toEqual([[1, 0, 0], [1, 1, 20], [1, 2, 40]]);
    expect(h.channel.of('REPLY_END')[0]).toEqual({ type: 'REPLY_END', callTurnIndex: 1, chunks: 3, deliveryState: 'FAILED' });
    expect(h.store.exchanges[0]!.closed).toMatchObject({ deliveryState: 'FAILED', heardMarkMs: 0, text: '' });
    // Heard on the phone: recorded on the QANDEEL track; never a mark of the exchange (it is not the reply's speech).
    const confirms = h.store.calls.filter((c) => c === 'confirmPlayout').length;
    expect(await h.stream.playout({ callTurnIndex: 1, chunkSeq: 1, playedMs: 40 })).toBe('APPLIED');
    expect(h.channel.qandeel.filter((q) => q.kind === 'PACKET')).toHaveLength(2);
    expect(h.store.calls.filter((c) => c === 'confirmPlayout').length).toBe(confirms);
    expect(await h.stream.playout({ callTurnIndex: 1, chunkSeq: 3, playedMs: 80 })).toBe('VIOLATION');
    h.stream.close();
  });

  it('F-01 not installed: nothing is played, and the reply closes FAILED with no chunk', async () => {
    const failing: LiveCallConversation = {
      reply: async (request) => {
        await request.storeSafety('ALLOW');
        return { kind: 'FAILED', stages: {} };
      },
      settleSafety: async () => undefined,
    };
    const h = harness(['مرحبا'], { conversation: failing, failureLine: null });
    await h.speak('loud', 400);
    await h.speak('quiet', 1_000);
    await until(() => h.channel.of('REPLY_END').length === 1);
    expect(h.channel.replyAudio).toEqual([]);
    expect(h.channel.of('REPLY_END')[0]).toEqual({ type: 'REPLY_END', callTurnIndex: 1, chunks: 0, deliveryState: 'FAILED' });
    h.stream.close();
  });
});
