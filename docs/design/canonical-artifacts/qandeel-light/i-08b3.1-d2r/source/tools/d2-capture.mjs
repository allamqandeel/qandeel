/**
 * I-08B3.1-D2R — THE CAPTURE.
 *
 * Nine sequences and four title cards, all from ONE page session: one browser, one document,
 * one layer tree, one font activation. D1 established that this is a STRICTER control than a
 * page load per sequence, not a looser one, and it is only safe because hiding an element in
 * this renderer writes its entire hidden state. The per-frame DOM digest below is what turns
 * "only safe because" into something a reader can check.
 *
 * WHAT IS CAPTURED AND WHY EACH ONE IS THERE:
 *
 *   ambient / ambient-rm      the field, still and then panned, across three worlds
 *   connection / connection-rm  the INHERITED control, driven by D1's own functions
 *   pattern / pattern-rm      convergence
 *   insight / insight-rm      emergence
 *   pattern-again             THE DETERMINISM CONTROL. The same sequence, captured a second
 *                             time later in the same session, after five other sequences have
 *                             used the same elements. If one frame of it differs from the
 *                             first pass, the document is not a pure function of the state and
 *                             every other claim in this package is weaker than it sounds.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';
import { launch, CHROME_CANDIDATES } from './d2-cdp.mjs';
import { T, TA, VIEW } from '../scene/d2-foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const WORK = join(PKG, '..', '.i08b31-d2-work');
const FRAMES = join(WORK, 'frames');

export const SEQUENCES = [
  { key: 'ambient', category: 'ambient', reduced: false, frames: TA.FRAMES, span: TA.TOTAL },
  { key: 'ambient-rm', category: 'ambient', reduced: true, frames: TA.FRAMES, span: TA.TOTAL },
  { key: 'connection', category: 'connection', reduced: false, frames: T.FRAMES, span: T.TOTAL },
  { key: 'connection-rm', category: 'connection', reduced: true, frames: T.FRAMES, span: T.TOTAL },
  { key: 'pattern', category: 'pattern', reduced: false, frames: T.FRAMES, span: T.TOTAL },
  { key: 'pattern-rm', category: 'pattern', reduced: true, frames: T.FRAMES, span: T.TOTAL },
  { key: 'insight', category: 'insight', reduced: false, frames: T.FRAMES, span: T.TOTAL },
  { key: 'insight-rm', category: 'insight', reduced: true, frames: T.FRAMES, span: T.TOTAL },
  { key: 'pattern-again', category: 'pattern', reduced: false, frames: T.FRAMES, span: T.TOTAL },
];

/** The four cards, in the order the coherence film uses them. */
export const CARDS = [
  { key: 'card-ambient', title: 'المحيط', sub: 'حياة العالم حين لا يحدث شيء' },
  { key: 'card-connection', title: 'الرابط', sub: 'معنى يتّصل بفهم سابق' },
  { key: 'card-pattern', title: 'النمط', sub: 'أشياء متفرّقة تصير بنية واحدة' },
  { key: 'card-insight', title: 'الفهم', sub: 'إدراك جديد ينبثق' },
];
export const CARD_FRAMES = 24;

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function run() {
  const proto = join(PKG, 'prototypes', 'D2_LIGHT_SYSTEM.html');
  if (!existsSync(proto)) {
    throw new Error('d2-capture: prototypes/D2_LIGHT_SYSTEM.html is missing. Run d2-build.mjs first.');
  }
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('d2-capture: no Chrome found in CHROME_CANDIDATES');

  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const br = await launch({ chrome, port: 9481 });
  const { targetId } = await br.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await br.send('Target.attachToTarget', { targetId, flatten: true });
  await br.send('Page.enable', {}, sessionId);
  await br.send('Emulation.setDeviceMetricsOverride',
    { width: VIEW.W, height: VIEW.H, deviceScaleFactor: VIEW.DPR, mobile: false }, sessionId);
  await br.send('Page.navigate', { url: pathToFileURL(proto).href + '?static' }, sessionId);

  const evalIn = async (expression) => {
    const r = await br.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) {
      throw new Error('d2-capture: the page threw — ' + JSON.stringify(r.exceptionDetails).slice(0, 800));
    }
    return r.result.value;
  };

  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await evalIn('!!(window.QD && window.QD.ready)')) break;
  }

  /* ------------------------------------------------------- guards, before any frame is kept */
  const guards = JSON.parse(await evalIn(`JSON.stringify({
    ready: !!(window.QD && window.QD.ready),
    stageW: document.getElementById('stage').offsetWidth,
    stageH: document.getElementById('stage').offsetHeight,
    docW: document.documentElement.scrollWidth,
    docH: document.documentElement.scrollHeight,
    fontActive: document.fonts.check('560 25px "QD-Estedad"'),
    fingerprint: [...document.querySelectorAll('#probe-box span')].map(function (s) { return Math.round(s.getBoundingClientRect().width * 100); }),
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    cssAnimations: /@keyframes|animation:|transition:/.test(document.documentElement.innerHTML),
  })`));

  const fail = [];
  if (!guards.ready) fail.push('the page never became ready');
  if (guards.stageW !== VIEW.W || guards.stageH !== VIEW.H) fail.push(`the stage is ${guards.stageW}x${guards.stageH}, expected ${VIEW.W}x${VIEW.H}`);
  if (guards.docW > VIEW.W || guards.docH > VIEW.H) fail.push(`the document overflows the stage at ${guards.docW}x${guards.docH}`);
  if (!guards.fontActive) fail.push('Estedad is not active — every measurement would be of a fallback face');
  if (new Set(guards.fingerprint).size !== 3) fail.push(`the weight probe returned ${JSON.stringify(guards.fingerprint)} — a variable font must render three distinct widths`);
  if (guards.dir !== 'rtl' || guards.lang !== 'ar') fail.push(`the document is dir=${guards.dir} lang=${guards.lang}`);
  if (guards.cssAnimations) fail.push('the page contains a CSS animation, transition or @keyframes');
  if (fail.length) throw new Error('d2-capture: pre-capture guards failed —\n  - ' + fail.join('\n  - '));

  /* --------------------------------------------------------------------------- the frames */
  const report = { generated: 'source/tools/d2-capture.mjs', guards, sequences: [], cards: [] };

  for (const seq of SEQUENCES) {
    const dir = join(FRAMES, seq.key);
    mkdirSync(dir, { recursive: true });
    await evalIn(`window.QD.setCard(null); window.QD.setMode(${JSON.stringify(seq.category)}, ${seq.reduced}); "ok"`);

    const mode = JSON.parse(await evalIn('JSON.stringify({c: window.QD.category, r: window.QD.reduced})'));
    if (mode.c !== seq.category || mode.r !== seq.reduced) {
      throw new Error(`d2-capture: asked for ${seq.category}/${seq.reduced} and the page reports ${mode.c}/${mode.r}`);
    }

    /* The semantic probe runs on a spread of frames across the event, not just its peak: a
       per-member weight that only appears while a link is still drawing would otherwise slip
       past a single sample. */
    const probeAt = new Set([0, 0.25, 0.45, 0.55, 0.65, 0.8, 1].map((p) => Math.round(p * (seq.frames - 1))));

    const digests = [];
    const hashes = [];
    const probes = [];
    /**
     * `filters` RECORDS, PER FRAME, WHICH ELEMENTS CARRY A CSS FILTER.
     *
     * Not decoration. Chrome promotes a filtered element to its own layer, and promotion shifts
     * how UNRELATED elements one layer above are rasterised — by one least-significant bit, on a
     * couple of pixels. Check R7 has to be able to say whether a change in the navigation region
     * is the navigation responding to something or a compositor artefact, and the only honest
     * way to answer that is to record what the document actually wrote rather than to infer it
     * from a state channel. Two attempts to infer it named the wrong channel.
     */
    const filters = [];
    for (let f = 0; f < seq.frames; f++) {
      const t = (f / (seq.frames - 1)) * seq.span;
      const v = JSON.parse(await evalIn(
        `(async () => { window.QD.apply(${t.toFixed(4)}); return JSON.stringify({`
        + ` d: await window.QD.digest(),`
        + ` f: ['prior','quiet','inode','recv'].map((id) => { const n = document.getElementById(id); return n && n.style.filter && n.style.filter !== 'none' ? id : ''; }).filter(Boolean).join('+') || 'none'`
        + ` }); })()`,
      ));
      digests.push(v.d);
      filters.push(v.f);
      if (probeAt.has(f)) probes.push({ frame: f, ...JSON.parse(await evalIn('JSON.stringify(window.QD.probe())')) });
      const shot = await br.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
      const buf = Buffer.from(shot.data, 'base64');
      writeFileSync(join(dir, `${String(f).padStart(4, '0')}.png`), buf);
      hashes.push(sha(buf));
    }
    report.sequences.push({ ...seq, digests, hashes, probes, filters });
    console.log(`  ${seq.key.padEnd(15)} ${seq.frames} frames`);
  }

  for (const c of CARDS) {
    const dir = join(FRAMES, c.key);
    mkdirSync(dir, { recursive: true });
    await evalIn(`window.QD.setCard(${JSON.stringify(c.title)}, ${JSON.stringify(c.sub)}); "ok"`);
    const shot = await br.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    const buf = Buffer.from(shot.data, 'base64');
    for (let f = 0; f < CARD_FRAMES; f++) writeFileSync(join(dir, `${String(f).padStart(4, '0')}.png`), buf);
    report.cards.push({ ...c, frames: CARD_FRAMES, sha256: sha(buf) });
    console.log(`  ${c.key.padEnd(15)} ${CARD_FRAMES} frames (one still, repeated)`);
  }
  await evalIn('window.QD.setCard(null); "ok"');

  await br.close();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data', 'D2_CAPTURE_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (isMain(import.meta.url)) {
  console.log('D2 CAPTURE');
  const r = await run();
  const total = r.sequences.reduce((s, x) => s + x.frames, 0) + r.cards.length * CARD_FRAMES;
  console.log(`  ${total} frames at ${VIEW.W * VIEW.DPR}x${VIEW.H * VIEW.DPR}, from one page session`);
  console.log('  wrote data/D2_CAPTURE_REPORT.json');
}

export { run };
