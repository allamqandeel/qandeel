import { LiveCallConversationBinding, type LiveCallConversation, type LiveCallReplyOutcome, type LiveCallReplyRequest } from './live-call-conversation.port';
import { LiveCallTurnEngine, type CallTurnObservation } from './live-call-turn.engine';
import { InMemoryCallTurnStore } from './testing/in-memory-call-turn-store';
import { FakeCallSynthesis, fakeCallSynthesisRoute } from './testing/fake-call-synthesis';
import { FakeCallTurnChannel } from './testing/fake-call-turn-channel';
import { FAKE_CALL_INTERIM, FakeCallRecognizer } from './testing/fake-call-recognizer';
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

function harness(script: string[], options: { disposition?: 'ALLOW' | 'GUIDED' | 'BLOCK'; bind?: boolean; finalDelayMs?: number; conversation?: LiveCallConversation } = {}) {
  const store = new InMemoryCallTurnStore();
  const binding = new LiveCallConversationBinding();
  const requests: LiveCallReplyRequest[] = [];
  const order: string[] = [];
  if (options.conversation) binding.bind(options.conversation);
  else if (options.bind !== false) {
    binding.bind({
      settleSafety: async () => {
        throw new Error('NOT_EXPECTED');
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
  const recognizer = new FakeCallRecognizer(script.map((text) => ({ text })), { finalDelayMs: options.finalDelayMs ?? 5 });
  const engine = new LiveCallTurnEngine(store, binding, recognizer, fakeCallSynthesisRoute(new FakeCallSynthesis()));
  const observed: CallTurnObservation[] = [];
  engine.observe((o) => observed.push(o));
  const channel = new FakeCallTurnChannel();
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
