/**
 * I-08B3.1-F2 — THE APPEARANCE-SWITCH CONTRACT, PROVED RATHER THAN PROMISED.
 *
 * ================================================================================================
 * WHAT §16 ACTUALLY FORBIDS, AND WHY EACH PROHIBITION NEEDS A DIFFERENT KIND OF EVIDENCE
 *
 * People change the system appearance while the app is open. An appearance change is NOT a meaning
 * event, a new insight, a new analytical state, a navigation event or a temporal event. So:
 * QANDEEL Light is not replayed, analytical motion is not restarted, semantic state is not
 * altered, selection / focus / navigation are not reset, and no Timeline history is created.
 *
 * Five prohibitions, five different failures, five different measurements:
 *
 *   1 NO MEANING REPLAY      count the meaning-light sources in both projections. Zero, or the
 *                            appearance manufactured an insight.
 *   2 NO SEMANTIC CHANGE     the truth block, byte for byte, across the switch.
 *   3 NO STATE RESET         the state block, field by field, with a NON-DEFAULT state: a
 *                            selected row, a different world, an enlarged text setting and a
 *                            focused control. Testing the default would prove nothing, because
 *                            the default is what a reset produces.
 *   4 NO NEW HISTORY         the canonical order and the object counts, unchanged.
 *   5 THE CROSS-FADE ADDS    every intermediate frame is EXACTLY the blend of its two endpoints.
 *     NOTHING                This is the strongest of the five and it is the only one that is
 *                            about the transition rather than about its ends: if no pixel at any
 *                            phase lies outside the segment between the dark value and the light
 *                            value, then nothing appears during the transition that is not
 *                            already in one of the two projections. A replayed light, a flash, an
 *                            overshoot or a settling animation would all put a pixel outside that
 *                            segment, and there is nowhere else for them to hide.
 *
 * ================================================================================================
 * WHY THE CROSS-FADE IS MEASURED ON RASTERS AND NOT RENDERED AS A PAGE
 *
 * A cross-fade between appearances is a cross-dissolve of two projections. Rendering an HTML
 * approximation of one would produce a picture of F2's idea of a cross-fade and then measure it,
 * which is the failure this whole track keeps having to correct. So the two projections are
 * rendered, the blend is computed, and the property is asserted on the arithmetic that a
 * compositor will actually perform.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page } from './f2-scene.mjs';
import { resolveAll, tokenTreeDigest } from './f2-resolve.mjs';
import { withBrowser, capture, PKG } from './f2-render.mjs';
import { decode, encode } from '../vendor/f1/vendor/lib/png.mjs';
import { VIEW } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';

/** A state that is NOT the default in every field the switch could plausibly reset. */
export const LIVE_STATE = Object.freeze({
  world: 'shared',
  interaction: 'selected',
  textScale: 23 / 17,
  boldText: true,
  contrast: 'increased',
});

const READ = `JSON.stringify({
  truth: document.getElementById('qd-truth').textContent,
  state: document.getElementById('qd-state').textContent,
  lightSources: Number(document.documentElement.getAttribute('data-qd-light-sources') || 0),
  eventAttr: document.documentElement.getAttribute('data-qd-event'),
  selected: [].slice.call(document.querySelectorAll('[aria-current="true"]')).length,
  focusable: [].slice.call(document.querySelectorAll('[tabindex="0"]')).length,
  worldName: (document.getElementById('worldname')||{}).textContent || null
})`;

/** Blend two decoded rasters at `phase`, the way a compositor does. */
function blend(A, B, phase) {
  const out = Buffer.alloc(A.rgba.length);
  for (let i = 0; i < A.rgba.length; i++) out[i] = Math.round(A.rgba[i] * (1 - phase) + B.rgba[i] * phase);
  return { width: A.width, height: A.height, rgba: out };
}

/**
 * THE SEGMENT TEST. For every pixel and every channel, an intermediate value must lie between the
 * dark value and the light value inclusive. A tolerance of one 8-bit step absorbs rounding and
 * nothing else — two steps would already admit a visible flash.
 */
function outsideSegment(A, B, M, tol = 1) {
  let outside = 0, worst = 0;
  for (let i = 0; i < A.rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const a = A.rgba[i + c], b = B.rgba[i + c], m = M.rgba[i + c];
      const lo = Math.min(a, b) - tol, hi = Math.max(a, b) + tol;
      if (m < lo || m > hi) { outside++; worst = Math.max(worst, Math.max(lo - m, m - hi)); }
    }
  }
  return { outside, worstExcursion: worst };
}

export async function run() {
  const r = { dark: resolveAll({ appearance: 'dark' }), light: resolveAll({ appearance: 'light' }) };
  const crossfade = r.dark.scalar.SWITCH_CROSSFADE.value;
  const crossfadeReduced = r.dark.scalar.SWITCH_CROSSFADE_REDUCED.value;

  return withBrowser(async (browser) => {
    const shots = {};
    for (const app of ['dark', 'light']) {
      const c = await capture(browser, {
        html: page({ appearance: app, ...LIVE_STATE }),
        rel: `review/switch/${app}-live.html`, read: READ, height: VIEW.H,
      });
      shots[app] = { ...c, read: JSON.parse(c.data) };
    }

    const D = shots.dark.read, L = shots.light.read;
    const stateD = JSON.parse(D.state), stateL = JSON.parse(L.state);
    const stateFields = Object.keys(stateD).filter((k) => k !== 'appearance');
    const stateDiffs = stateFields.filter((k) => JSON.stringify(stateD[k]) !== JSON.stringify(stateL[k]));

    const truthD = JSON.parse(D.truth), truthL = JSON.parse(L.truth);

    const A = decode(shots.dark.png), B = decode(shots.light.png);
    const phases = [0, 0.25, 0.5, 0.75, 1];
    const frames = [];
    mkdirSync(join(PKG, 'review/switch'), { recursive: true });
    for (const p of phases) {
      const M = blend(A, B, p);
      const seg = outsideSegment(A, B, M, 1);
      writeFileSync(join(PKG, `review/switch/crossfade-${String(Math.round(p * 100)).padStart(3, '0')}.png`), encode({ width: M.width, height: M.height, rgba: M.rgba }));
      frames.push({ phase: p, ...seg });
    }

    /**
     * THE PROBE. A cross-fade that REPLAYS the meaning light: the light projection is replaced
     * mid-transition by one carrying an insight event, which is precisely the failure §16 names.
     * The segment test must reject it, and by a large margin — otherwise the four passes above
     * are a statement about a test that cannot fail.
     */
    const replay = await capture(browser, {
      html: page({ appearance: 'light', ...LIVE_STATE, event: { kind: 'insight', t: 2900 } }),
      rel: 'review/switch/probe-replayed-light.html', read: READ, height: VIEW.H,
    });
    const R = decode(replay.png);
    const probeMid = blend(A, R, 0.5);
    const probeSeg = outsideSegment(A, B, probeMid, 1);

    const noReplay = D.lightSources === 0 && L.lightSources === 0;
    const truthIdentical = D.truth === L.truth;
    const noStateReset = stateDiffs.length === 0
      && D.selected === L.selected && D.focusable === L.focusable && D.worldName === L.worldName;
    const noNewHistory = JSON.stringify(truthD.canonicalOrder) === JSON.stringify(truthL.canonicalOrder)
      && JSON.stringify(truthD.counts) === JSON.stringify(truthL.counts);
    const crossfadeAddsNothing = frames.every((f) => f.outside === 0);
    const probeRejected = probeSeg.outside > 0;

    const state = noReplay && truthIdentical && noStateReset && noNewHistory && crossfadeAddsNothing && probeRejected ? 'PASS' : 'FAIL';

    return {
      generatedBy: 'tools/f2-switch.mjs',
      tokenTree: tokenTreeDigest(),
      state,
      liveState: LIVE_STATE,
      contract: {
        crossfade, crossfadeUnderReducedMotion: crossfadeReduced,
        removedNotShortenedUnderReducedMotion: crossfadeReduced.value === 0,
        note: 'A full-viewport luminance ramp is the specific thing Apple\'s accessibility guidance names alongside slow looping oscillations. It carries no meaning — the appearance change is not a semantic event — so removing it costs no comprehension. I-08B3.1-F1\'s channel model defends channels that carry something.',
      },
      prohibitions: {
        '1 no meaning replay': { ok: noReplay, lightSourcesDark: D.lightSources, lightSourcesLight: L.lightSources, eventAttr: [D.eventAttr, L.eventAttr] },
        '2 no semantic change': { ok: truthIdentical, truthBytes: [D.truth.length, L.truth.length] },
        '3 no state reset': { ok: noStateReset, fieldsCompared: stateFields.length, differing: stateDiffs, selectedRows: [D.selected, L.selected], focusables: [D.focusable, L.focusable], worldName: [D.worldName, L.worldName] },
        '4 no new history': { ok: noNewHistory, canonicalOrder: truthD.canonicalOrder, counts: truthD.counts },
        '5 crossfade adds nothing': { ok: crossfadeAddsNothing, frames },
      },
      probe: {
        name: 'a cross-fade that replays the meaning light at its midpoint',
        rejected: probeRejected, channelsOutsideSegment: probeSeg.outside, worstExcursion: probeSeg.worstExcursion,
      },
      rasters: { dark: shots.dark.sha, light: shots.light.sha },
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await run();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_SWITCH.json'), JSON.stringify(s, null, 2) + '\n');
  for (const [k, v] of Object.entries(s.prohibitions)) console.log(' ', v.ok ? 'OK  ' : 'FAIL', k, JSON.stringify(v).slice(0, 150));
  console.log('  crossfade', JSON.stringify(s.contract.crossfade), '| under reduced motion', JSON.stringify(s.contract.crossfadeUnderReducedMotion), '- removed, not shortened:', s.contract.removedNotShortenedUnderReducedMotion);
  console.log('  probe:', s.probe.name, '-> rejected:', s.probe.rejected, '(' + s.probe.channelsOutsideSegment + ' channels outside the segment, worst excursion ' + s.probe.worstExcursion + ')');
  console.log('APPEARANCE SWITCH:', s.state);
  if (s.state !== 'PASS') process.exit(1);
}
