import { LiveCallConversationBinding, type LiveCallReplyOutcome, type LiveCallReplyRequest } from './live-call-conversation.port';
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

function harness(script: string[], options: { disposition?: 'ALLOW' | 'GUIDED' | 'BLOCK'; bind?: boolean; finalDelayMs?: number } = {}) {
  const store = new InMemoryCallTurnStore();
  const binding = new LiveCallConversationBinding();
  const requests: LiveCallReplyRequest[] = [];
  const order: string[] = [];
  if (options.bind !== false) {
    binding.bind({
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
});
