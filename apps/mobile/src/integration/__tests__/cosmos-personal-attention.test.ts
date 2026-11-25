/**
 * INTEL-LIVE-01 CP2 (D-5) — the Personal owner folds the running call's provisional attention into its stage: a subject on
 * one of the person's Threads glows that body, any other is an ember; the stage changes with each development (digest)
 * and returns exactly to the stage without the layer once it is empty. No call: the snapshot is the one it always was.
 */
import { harness, settle, SESSION_A } from '../__fixtures__/integration';
import { mapProjectionRequest } from '../../map';
import { viewportEnvelope } from '../../map/camera';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '../../projection';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import { createPersonalCosmosOwner } from '../../cosmos/product';
import { EMPTY_ATTENTION_LAYER, ProvisionalAttention } from '../../call/provisional-attention';
import type { CallOwner } from '../../call';
import { SPRITE, SPRITE_STRIDE, TINT } from '../../cosmos/core/stage';

const GLASS = viewportEnvelope(390, 844, { top: 104, bottom: 220 })!;
const LIVE_HEAD = 6;
const projection: Responder = (request) => {
  const params = new URL(request.url).searchParams;
  return {
    status: 200,
    body: disclosureFixture({
      depth: (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth, sessionId: SESSION_A, tc: Number(params.get('tc') ?? LIVE_HEAD), liveHead: LIVE_HEAD,
      threads: [{ id: 'thread-a', x: '0', y: '0' }, { id: 'thread-b', x: '500000', y: '0' }],
      appearances: [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }],
      readings: [{ id: 'reading-1' }], focuses: [],
    }),
  };
};

/** The runtime's call owner with a real layer, fed protocol v3 messages as the client delivers them. */
function callWithLayer(base: CallOwner) {
  let layer: ProvisionalAttention | null = new ProvisionalAttention(() => 0);
  const listeners = new Set<() => void>();
  const tell = () => { for (const l of listeners) l(); };
  const call: CallOwner = {
    ...base,
    getAttention: () => layer?.current ?? EMPTY_ATTENTION_LAYER,
    subscribeAttention: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  return {
    call,
    set: (seq: number, key: string, threadRef: string | null, track: 'USER' | 'QANDEEL' = 'USER') => {
      if (layer!.event({ type: 'ATTENTION', seq, op: 'SET', track, subjectKey: key, label: `L ${key}`, kind: 'TOPIC', confidence: 'HIGH', threadRef, producedClockMs: seq })) tell();
    },
    withdraw: (seq: number, key: string) => {
      if (layer!.event({ type: 'ATTENTION', seq, op: 'WITHDRAW', track: 'USER', subjectKey: key, label: `L ${key}`, kind: 'TOPIC', confidence: 'HIGH', threadRef: null, producedClockMs: seq })) tell();
    },
    end: () => { layer = null; tell(); },
  };
}

describe('INTEL-LIVE-01 CP2: the Personal owner shows the call\'s provisional attention', () => {
  it('each development changes the stage; a glow of a Thread, an ember otherwise; the end returns it exactly', async () => {
    const h = await harness({ liveHead: LIVE_HEAD, projection });
    const runtime = h.ready();
    const live = callWithLayer(runtime.call);
    const owner = createPersonalCosmosOwner({ runtime: { ...runtime, call: live.call }, language: 'ar' });
    owner.setGlass(GLASS);
    const request = mapProjectionRequest(runtime.store.getState());
    if (request !== null) await runtime.projection.ensure(request);
    await settle();
    const base = owner.getSnapshot();
    expect(base.status).toBe('READY');
    const spritesOf = (s: typeof base) => {
      const sp = s.list.layers[0]!.sprites; const out: number[][] = [];
      for (let i = 0; i < sp.length; i += SPRITE_STRIDE) out.push([sp[i + 3]!, sp[i + 4]!, sp[i + 5]!]);
      return out;
    };
    let changes = 0;
    owner.subscribe(() => { changes += 1; });

    live.set(1, 'manager', 'thread-a');
    const glowed = owner.getSnapshot();
    expect(glowed.list.digest).not.toBe(base.list.digest);
    expect(spritesOf(glowed).slice(spritesOf(base).length)).toEqual([[SPRITE.PUFF, expect.any(Number), 0.28]]);
    expect(glowed.list.layers[0]!.hits).toEqual(base.list.layers[0]!.hits);
    // B7: the stage is compiled when the layer's marks change, never again for the same marks (a re-read, the glass).
    owner.setGlass(GLASS);
    expect(owner.getSnapshot().list).toBe(glowed.list);

    live.set(2, 'trip', null);
    const ember = owner.getSnapshot();
    expect(ember.list.digest).not.toBe(glowed.list.digest);
    expect(spritesOf(ember).slice(spritesOf(base).length).map((s) => s.slice(0, 2))).toEqual([[SPRITE.PUFF, expect.any(Number)], [SPRITE.SPARK, TINT.WARM]]);
    expect(ember.list.layers[0]!.labels.map((l) => l.text)).toContain('L trip');

    live.set(3, 'reply', null, 'QANDEEL');
    expect(owner.getSnapshot().list.layers[0]!.labels.map((l) => l.id)).toEqual(expect.arrayContaining(['ATTENTION:USER:trip', 'ATTENTION:QANDEEL:reply']));

    live.withdraw(4, 'trip');
    expect(owner.getSnapshot().list.layers[0]!.labels.map((l) => l.id)).not.toContain('ATTENTION:USER:trip');

    live.end();
    expect(owner.getSnapshot().list).toEqual(base.list);
    expect(changes).toBe(5);
    owner.dispose();
  });
});
