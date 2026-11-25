// INTEL-LIVE-01 CP2 (D-5 = CP0 v1.1 §3.7) — the stage's attention marks: byte-identical without them (B4 / B7), a glow of a
// real body in its own dye, an ember in the warm role tint with an ordinary label, no hit, no line, no new draw pass, at most
// twelve per rung, and gone once withdrawn.

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { deriveMapSceneFromDisclosure } from '../../map/projection/map-scene';
import { canonicalWorldAddress } from '../../map/world';
import type { PublicFieldEntry, SharedFieldEntry } from '../../runtime-entry';
import { PERSONAL_DEPTHS, personalDrawList, personalScene, publicScene, sharedScene } from '../core/adapters';
import { SPRITE, SPRITE_STRIDE, TINT, compileStage, drawOpsAtRest, type AttentionMark, type SceneInput, type Stage } from '../core/stage';

const ORIGIN = { x: 0n, y: 0n };
const address = (x: bigint, y: bigint) => { const a = canonicalWorldAddress(x, y); if (!a.ok) throw new Error('not canonical'); return a.address; };
function entries(count: number): PublicFieldEntry[] {
  let seed = 20261125;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_unused, i) => {
    const cluster = i % 16;
    const cx = (cluster % 4 - 1.5) * 1_500_000; const cy = (Math.floor(cluster / 4) - 1.5) * 1_500_000;
    return { id: `fixture-${i}`, address: address(BigInt(Math.round(cx + (rnd() - 0.5) * 900_000)), BigInt(Math.round(cy + (rnd() - 0.5) * 900_000))), meaning: `Synthetic entry ${i + 1}`, region: `c${cluster}` };
  });
}
const sharedEntries = (): SharedFieldEntry[] => entries(9).map((e) => ({ id: e.id, address: e.address, meaning: e.meaning, region: e.region }));

function personalInputs(inspected: string | null = null, rtl = false): SceneInput[] {
  const threads = [[0, 0, 1], [1, 0, 2], [-1, 1, 3]].map(([x, y, sp], i) => ({ id: `p-thread-${i}`, x: String(x * 1_000_000), y: String(y * 1_000_000), establishedSp: sp }));
  const appearances = [0, 0, 1, 2].map((t, i) => ({ bindingId: `p-binding-${t}-${i}`, threadId: `p-thread-${t}`, readingId: `p-reading-${t}-${i}`, boundSp: 4, current: i !== 1 }));
  return PERSONAL_DEPTHS.map((depth) => {
    const disclosure = disclosureFixture({ depth, sessionId: 'fixture-session', tc: 12, liveHead: 12, threads, appearances, readings: appearances.map((a) => ({ id: a.readingId })), focuses: [] });
    const derived = deriveMapSceneFromDisclosure(disclosure, { sessionId: 'fixture-session', tc: 12, depth } as never);
    if (derived.status !== 'SCENE') throw new Error('expected a scene');
    return personalScene(derived.scene, inspected, rtl, ORIGIN, new Map([['p-thread-1', 'مديري']]));
  });
}

/** The scenes whose stages the golden holds (recorded from the stage BEFORE the amendment). */
function goldenScenes(): Record<string, () => Stage> {
  return {
    personal: () => personalDrawList(personalInputs()).list,
    personalInspected: () => personalDrawList(personalInputs('THREAD:p-thread-1', true)).list,
    publicField: () => compileStage(publicScene({ entries: entries(64), focusId: 'fixture-7', relatedIds: ['fixture-9'], section: null, rtl: false }, ORIGIN)),
    shared: () => compileStage(sharedScene(sharedEntries(), 'fixture-3', true, ORIGIN)),
  };
}
const sha = (stage: Stage) => createHash('sha256').update(JSON.stringify(stage)).digest('hex');
const GOLDEN = join(__dirname, '__golden__', 'stage-attention-undefined.golden.json');
const WRITE = process.env.QANDEEL_WRITE_GOLDEN === '1';

const sprites = (stage: Stage, rung: number) => {
  const sp = stage.layers[rung]!.sprites; const out: { x: number; y: number; size: number; sprite: number; tint: number; alpha: number }[] = [];
  for (let i = 0; i < sp.length; i += SPRITE_STRIDE) out.push({ x: sp[i]!, y: sp[i + 1]!, size: sp[i + 2]!, sprite: sp[i + 3]!, tint: sp[i + 4]!, alpha: sp[i + 5]! });
  return out;
};
const mark = (subjectKey: string, entityId: string | null = null, label = subjectKey): AttentionMark => ({ subjectKey, label, entityId, confidence: 'HIGH' });
const withAttention = (inputs: SceneInput[], attention: readonly AttentionMark[] | undefined) => inputs.map((input) => (attention === undefined ? input : { ...input, attention }));

describe('INTEL-LIVE-01 CP2 attention marks on the stage', () => {
  it('without attention the stage is byte-identical to the stage before the amendment (golden), and an empty list is too', () => {
    const produced: Record<string, { digest: string; sha256: string }> = {};
    for (const [name, build] of Object.entries(goldenScenes())) { const stage = build(); produced[name] = { digest: stage.digest, sha256: sha(stage) }; }
    if (WRITE) {
      mkdirSync(join(__dirname, '__golden__'), { recursive: true });
      writeFileSync(GOLDEN, `${JSON.stringify(produced, null, 1)}\n`);
    }
    expect(existsSync(GOLDEN)).toBe(true);
    expect(produced).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
    const empty = personalDrawList(withAttention(personalInputs(), []));
    expect(sha(empty.list)).toBe(produced.personal!.sha256);
  });

  it('a subject on one of the person\'s Threads is a glow of that body: one PUFF in its own dye, alpha 0.28, 1.6× its halo, no gold, no hit', () => {
    const inputs = personalInputs();
    const before = personalDrawList(inputs).list;
    const after = personalDrawList(withAttention(inputs, [mark('USER:manager', 'THREAD:p-thread-1')])).list;
    const thread = inputs[0]!.entities.find((e) => e.id === 'THREAD:p-thread-1')!;
    for (let rung = 0; rung < PERSONAL_DEPTHS.length; rung += 1) {
      const added = sprites(after, rung).slice(sprites(before, rung).length);
      const k = 1 / 8 ** rung;
      expect(added).toEqual([{ x: thread.x, y: thread.y, size: (rung === 0 ? 13 : 15) * 3.6 * 1.6 * k, sprite: SPRITE.PUFF, tint: thread.dye, alpha: 0.28 }]);
      expect(added.every((s) => s.tint !== TINT.GOLD)).toBe(true);
      expect(after.layers[rung]!.hits).toEqual(before.layers[rung]!.hits);
      expect(after.layers[rung]!.lines).toEqual(before.layers[rung]!.lines);
      expect(after.layers[rung]!.labels).toEqual(before.layers[rung]!.labels); // no title change
      expect(drawOpsAtRest(after, rung)).toBe(drawOpsAtRest(before, rung));
    }
    expect(after.digest).not.toBe(before.digest);
  });

  it('a subject with no body is an ember: one warm SPARK (alpha 0.6, size 14) and an ordinary warm label; no body, line, halo or hit', () => {
    const inputs = personalInputs();
    const before = personalDrawList(inputs).list;
    const after = personalDrawList(withAttention(inputs, [mark('USER:trip', null, 'رحلة الإسكندرية'), mark('USER:ghost', 'THREAD:not-on-the-map', 'Ghost')])).list;
    for (let rung = 0; rung < PERSONAL_DEPTHS.length; rung += 1) {
      const k = 1 / 8 ** rung;
      const added = sprites(after, rung).slice(sprites(before, rung).length);
      expect(added.map((s) => [s.sprite, s.tint, s.alpha, s.size])).toEqual([[SPRITE.SPARK, TINT.WARM, 0.6, 14 * k], [SPRITE.SPARK, TINT.WARM, 0.6, 14 * k]]);
      const labels = after.layers[rung]!.labels.slice(before.layers[rung]!.labels.length);
      expect(labels.map((l) => [l.text, l.emphasis, l.major, l.tint])).toEqual([['رحلة الإسكندرية', false, false, TINT.WARM], ['Ghost', false, false, TINT.WARM]]);
      expect(after.layers[rung]!.hits).toEqual(before.layers[rung]!.hits);
      expect(after.layers[rung]!.lines).toEqual(before.layers[rung]!.lines);
      expect(drawOpsAtRest(after, rung)).toBe(drawOpsAtRest(before, rung));
    }
  });

  it('draws at most twelve marks per rung (the newest), in the same atlas draw; drawOpsAtRest is unchanged', () => {
    const inputs = personalInputs();
    const before = personalDrawList(inputs).list;
    const twenty = Array.from({ length: 20 }, (_, i) => mark(`USER:s${i}`, null, `S${i}`));
    const after = personalDrawList(withAttention(inputs, twenty)).list;
    for (let rung = 0; rung < PERSONAL_DEPTHS.length; rung += 1) {
      expect(sprites(after, rung).length - sprites(before, rung).length).toBe(12);
      expect(after.layers[rung]!.labels.slice(before.layers[rung]!.labels.length).map((l) => l.text)).toEqual(twenty.slice(-12).map((m) => m.label));
      expect(drawOpsAtRest(after, rung)).toBe(drawOpsAtRest(before, rung));
    }
  });

  it('a withdrawn mark is gone: the stage returns exactly to the stage without it', () => {
    const inputs = personalInputs();
    const one = personalDrawList(withAttention(inputs, [mark('USER:a'), mark('USER:b')])).list;
    const withdrawn = personalDrawList(withAttention(inputs, [mark('USER:a')])).list;
    const none = personalDrawList(withAttention(inputs, undefined)).list;
    expect(withdrawn.digest).not.toBe(one.digest);
    expect(sha(personalDrawList(withAttention(inputs, [])).list)).toBe(sha(none));
    expect(withdrawn).toEqual(personalDrawList(withAttention(inputs, [mark('USER:a')])).list);
  });

  it('an ember\'s place is presentation only and the same in RTL and LTR; the label keeps its own words', () => {
    const ltr = personalDrawList(withAttention(personalInputs(null, false), [mark('USER:trip', null, 'Trip')])).list;
    const rtl = personalDrawList(withAttention(personalInputs(null, true), [mark('USER:trip', null, 'رحلة')])).list;
    const at = (stage: Stage) => stage.layers[2]!.labels.filter((l) => l.id === 'ATTENTION:USER:trip').map((l) => [l.x, l.y]);
    expect(at(ltr)).toEqual(at(rtl));
    expect(rtl.layers[2]!.labels.find((l) => l.id === 'ATTENTION:USER:trip')!.text).toBe('رحلة');
  });
});
