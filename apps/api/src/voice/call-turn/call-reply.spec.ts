import { randomUUID } from 'node:crypto';
import { CallReply, callRetrievalTerms, type CallReplyEvent } from './call-reply';
import { InMemoryCallTurnStore } from './testing/in-memory-call-turn-store';
import { FakeCallSynthesis, fakeCallSynthesisRoute, type FakeCallSynthesisOptions } from './testing/fake-call-synthesis';
import { FakeCallTurnChannel } from './testing/fake-call-turn-channel';

const FIRST = 'أهلًا بك، سعيد بسماع صوتك.';
const SECOND = 'كيف كان يومك حتى الآن؟';
const CALM = { expression: 'CALM' as const, hints: [] };

const commitInput = (content: string) => ({
  userId: 'u', callId: 'c', epoch: 1, turnId: randomUUID(), commitId: randomUUID(), channel: 'SPEECH' as const, content, band: 'HIGH' as const, anchorStartMs: 0, anchorEndMs: 20,
  terms: [], closeAssistantTurnId: randomUUID(), closeEventId: randomUUID(),
});

async function until(condition: () => boolean, ms = 3_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('CONDITION_NOT_MET');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

async function exchange(synthesis: FakeCallSynthesisOptions = {}) {
  const store = new InMemoryCallTurnStore();
  const channel = new FakeCallTurnChannel();
  channel.captureMs = 5_000;
  const adapter = new FakeCallSynthesis(synthesis);
  const events: CallReplyEvent[] = [];
  const signals: string[] = [];
  const committed = await store.commit(commitInput('مرحبا'));
  await store.storeSafety({ callTurnIndex: committed.callTurnIndex!, disposition: 'ALLOW' });
  const reply = new CallReply({
    store, route: fakeCallSynthesisRoute(adapter), channel, signal: (op, outcome) => signals.push(`${op}:${outcome}`), observe: (e) => events.push(e), now: Date.now,
  }, committed.callTurnIndex!);
  const finished = () => store.calls.includes('finishGeneration');
  /** Confirms the sent packets `from..to` (exclusive), each at its end. */
  const play = async (from: number, to: number) => {
    for (let seq = from; seq < to; seq += 1) await reply.playout({ chunkSeq: seq, playedMs: (seq + 1) * 20 });
  };
  const ends = () => channel.of('REPLY_END');
  return { store, channel, adapter, events, signals, reply, finished, play, ends, ex: () => store.exchanges[0]! };
}

describe('S8B-05 CP2 a call reply: synthesis, REPLY_AUDIO, PLAYOUT truth and the one close (CA-05-02)', () => {
  it('COMPLETE: every piece spoken in order, the phone confirms it all, closed PLAYED_OUT with the whole text', async () => {
    const h = await exchange();
    h.reply.release(FIRST, CALM);
    h.reply.release(SECOND, CALM);
    h.reply.generationEnded('COMPLETE');
    await until(h.finished);
    const sent = h.channel.replyAudio.length;
    expect(sent).toBeGreaterThan(0);
    expect(h.channel.replyAudio.map((p) => [p.callTurnIndex, p.chunkSeq, p.offsetMs])).toEqual(
      Array.from({ length: sent }, (_, i) => [1, i, i * 20]));
    expect(h.adapter.requests.every((r) => r.hint !== null)).toBe(true);
    await h.play(0, sent);
    await until(() => h.ends().length === 1);
    expect(h.ends()).toEqual([{ type: 'REPLY_END', callTurnIndex: 1, chunks: sent, deliveryState: 'COMPLETE' }]);
    expect(h.ex().closed).toMatchObject({ deliveryState: 'COMPLETE', heardMarkMs: sent * 20, text: FIRST + SECOND, reason: 'PLAYED_OUT' });
    // The QANDEEL track: NOT_SPEAKING up to the reply's clock start, then each confirmed packet at its instant.
    expect(h.channel.qandeel[0]).toEqual({ kind: 'SILENCE', endMs: 5_000 });
    expect(h.channel.qandeel.slice(1)).toEqual(Array.from({ length: sent }, (_, i) => ({ kind: 'PACKET', clockMs: 5_000 + i * 20 })));
    // AI-COST-01: one ledger row per synthesis attempt, each settled with the provider's usage.
    const rows = [...h.store.ledger.values()];
    expect(rows.length).toBe(h.adapter.requests.length);
    expect(rows.every((r) => r.kind === 'SPEECH' && r.callTurnIndex === 1 && r.outcome === 'SUCCEEDED' && r.usage.AUDIO_OUTPUT_TOKEN! > 0)).toBe(true);
    expect(h.events.filter((e) => e.kind === 'FIRST_AUDIO')).toHaveLength(1);
    // A confirmation after the close changes nothing.
    expect(await h.reply.playout({ chunkSeq: 0, playedMs: 20 })).toBe('IGNORED');
    expect(h.events.some((e) => e.kind === 'LATE' && e.what === 'PLAYOUT')).toBe(true);
  });

  it('INTERRUPTED by the next turn (N1): only the pieces whose audio was wholly heard become the reply text', async () => {
    const h = await exchange();
    h.reply.release(FIRST, CALM);
    h.reply.release(SECOND, CALM);
    h.reply.generationEnded('COMPLETE');
    await until(h.finished);
    const firstEnd = h.ex().segments.find((s) => s.seq === 0)!.endMs;
    await h.play(0, firstEnd / 20 + 1);
    const next = await h.store.commit(commitInput('لحظة'));
    expect(next.closed).toMatchObject({ callTurnIndex: 1, deliveryState: 'INTERRUPTED' });
    h.reply.closedBy(next.closed!.deliveryState);
    expect(h.ends()).toEqual([expect.objectContaining({ deliveryState: 'INTERRUPTED' })]);
    expect(h.ex().closed).toMatchObject({ text: FIRST, reason: 'NEXT_TURN' });
    expect(h.reply.signal.aborted).toBe(true);
  });

  it('INTERRUPTED before any audio was heard: the reply text is empty and nothing is on the QANDEEL track', async () => {
    const h = await exchange({ firstByteMs: 50 });
    h.reply.release(FIRST, CALM);
    const next = await h.store.commit(commitInput('لا، انتظر'));
    h.reply.closedBy(next.closed!.deliveryState);
    expect(h.ex().closed).toMatchObject({ deliveryState: 'INTERRUPTED', heardMarkMs: 0, text: '' });
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(h.channel.replyAudio).toEqual([]);
    expect(h.channel.qandeel).toEqual([]);
    // The cancelled attempt is settled once, never as a success, and no late chunk is sent.
    expect([...h.store.ledger.values()].every((r) => r.outcome !== 'SUCCEEDED')).toBe(true);
  });

  it('WITHHELD_TAIL: what was released is spoken and heard; the close keeps the generation\'s state', async () => {
    const h = await exchange();
    h.reply.release(FIRST, CALM);
    h.reply.generationEnded('WITHHELD_TAIL');
    await until(h.finished);
    await h.play(0, h.channel.replyAudio.length);
    await until(() => h.ends().length === 1);
    expect(h.ends()[0]).toMatchObject({ deliveryState: 'WITHHELD_TAIL' });
    expect(h.ex().closed).toMatchObject({ text: FIRST, reason: 'PLAYED_OUT' });
  });

  it('FAILED: a generation that produced no audio closes GENERATION_FAILED at once, with no synthesis and no ledger row', async () => {
    const h = await exchange();
    h.reply.generationEnded('FAILED');
    await until(() => h.ends().length === 1);
    expect(h.ends()).toEqual([{ type: 'REPLY_END', callTurnIndex: 1, chunks: 0, deliveryState: 'FAILED' }]);
    expect(h.ex().closed).toMatchObject({ deliveryState: 'FAILED', text: '', reason: 'GENERATION_FAILED' });
    expect(h.store.ledger.size).toBe(0);
  });

  it('PLAYOUT: a chunk never sent, or a mark outside its chunk, is a violation; an older or repeated mark is ignored (P1)', async () => {
    const h = await exchange();
    h.reply.release(FIRST, CALM);
    h.reply.generationEnded('COMPLETE');
    await until(h.finished);
    const sent = h.channel.replyAudio.length;
    expect(await h.reply.playout({ chunkSeq: sent, playedMs: (sent + 1) * 20 })).toBe('VIOLATION');
    expect(await h.reply.playout({ chunkSeq: 1, playedMs: 10 })).toBe('VIOLATION');
    expect(await h.reply.playout({ chunkSeq: 1, playedMs: 40 })).toBe('APPLIED');
    const written = h.channel.qandeel.length;
    expect(await h.reply.playout({ chunkSeq: 0, playedMs: 20 })).toBe('IGNORED');
    expect(await h.reply.playout({ chunkSeq: 1, playedMs: 40 })).toBe('IGNORED');
    expect(h.channel.qandeel.length).toBe(written);
    expect(h.ex().markMs).toBe(40);
  });

  it('one close wins: PLAYED_OUT and the next turn racing give ONE REPLY_END and one frozen truth (P2)', async () => {
    const h = await exchange();
    h.reply.release(FIRST, CALM);
    h.reply.generationEnded('COMPLETE');
    await until(h.finished);
    const playing = h.play(0, h.channel.replyAudio.length);
    const next = await h.store.commit(commitInput('تمام'));
    if (next.closed) h.reply.closedBy(next.closed.deliveryState);
    await playing;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.ends()).toHaveLength(1);
    expect(h.ends()[0]!.deliveryState).toBe(h.ex().closed!.deliveryState);
  });

  it('a known failure before audio is retried once, each attempt its own ledger row; the reply still plays', async () => {
    const h = await exchange({ failFirst: 1 });
    h.reply.release(FIRST, CALM);
    h.reply.generationEnded('COMPLETE');
    await until(h.finished);
    const outcomes = [...h.store.ledger.values()].map((r) => r.outcome);
    expect(outcomes[0]).toBe('FAILED');
    expect(outcomes.slice(1).every((o) => o === 'SUCCEEDED')).toBe(true);
    expect(h.channel.replyAudio.length).toBeGreaterThan(0);
  });

  it('the call retrieval terms follow 0190 (lower-case, 2 – 48 characters, at most 64, no duplicates)', () => {
    const terms = callRetrievalTerms('Coffee coffee قهوة القهوة a');
    expect(terms).toEqual([...new Set(terms)]);
    expect(terms.every((t) => t === t.toLowerCase() && t.length >= 2 && t.length <= 48)).toBe(true);
    expect(callRetrievalTerms('كلمة '.repeat(200)).length).toBeLessThanOrEqual(64);
  });
});
