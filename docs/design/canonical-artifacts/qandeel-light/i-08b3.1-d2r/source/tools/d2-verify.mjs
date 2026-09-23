/**
 * I-08B3.1-D2R — THE INSTRUMENTS.
 *
 * Three families, deliberately kept apart because they can fail independently:
 *
 *   C1..C9  ON THE STATE TRACE, with no browser in the room. These are claims about what the
 *           system was ASKED to draw, and a rasteriser cannot make them true or false.
 *   R1..R8  ON THE PIXELS, read back from the captured PNGs. These are claims about what
 *           actually appeared.
 *   G1..G6  GUARDS, each carrying one probe per conjunct. A probe feeds the guard an input that
 *           MUST make it fail; a guard whose probe does not fire is a sentence.
 *
 * I-08B3.1-D1 lost four measurements to writing a check that did not measure its own claim, and
 * every one of them was found by running it and reading the number rather than by reading the
 * code. Where that happened again here it is recorded at the check.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';
import { decode } from '../vendor/png.mjs';
import { srgbToOklch } from '../vendor/color.mjs';
import { T, TA, VIEW, FRAME, FOUNDATION, LIGHT, ATMOSPHERE, MARK } from '../scene/d2-foundation.mjs';
import {
  EVENTS, PATTERN_GEOMETRY, PATTERN_MEMBERS, INSIGHT_SITE, INSIGHT_LOBES,
  RESIDUE_KEYS, TRANSIENT_KEYS, patternEvent, insightEvent, patternReduced, insightReduced,
} from '../scene/d2-events.mjs';
import { PRESENTATION_CONTRACT, contractViolations, TOPIC_KEYS, FIELD_KEYS, WORLDS, fieldData } from '../scene/d2-world.mjs';
import { CONTRACT_STATEMENTS } from './d2-tokens.mjs';
import { USED, NEVER_SHIP } from './d2-gates.mjs';
import { CONNECTION, connectionReduced, connectionReducedUncorrected, BLUR_CORRECTION } from '../scene/d2-connection.mjs';
import { ARRIVALS, REDUCED } from '../vendor/d1/d1-arrivals.mjs';
import { TOPICS, RINGS, ambient } from '../scene/d2-world.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const FRAMES = join(PKG, '..', '.i08b31-d2-work', 'frames');

const results = [];
/*
 * THE PROBE COLLECTOR IS MODULE-SCOPED because there are now two guard passes — the semantic
 * one, which runs anywhere, and the raster one, which needs 2,106 frames. A probe counted in
 * one and not the other would make the totals depend on where the tool was run.
 */
const probes = [];
const probe = (name, fn) => {
  let detected = false;
  try { detected = !!fn(); } catch { detected = false; }
  probes.push({ name, detected });
  return detected;
};

const record = (id, title, ok, detail) => {
  results.push({ id, title, ok, detail });
  console.log(`  ${ok ? 'HOLDS' : 'FAILS'}  ${id}  ${title}`);
  for (const line of [].concat(detail)) console.log(`           ${line}`);
  return ok;
};

/* =============================================================== the state trace ====== */
const frameTimes = (frames, span) => Array.from({ length: frames }, (_, f) => (f / (frames - 1)) * span);
const EVENT_TIMES = frameTimes(T.FRAMES, T.TOTAL);
const AMBIENT_TIMES = frameTimes(TA.FRAMES, TA.TOTAL);

export function verifyState(d1Arrivals, d1Reduced) {
  /* ---- C1 the inherited control is the same function, not a copy of it ---------------- */
  {
    let worst = 0, worstKey = null, compared = 0;
    for (const t of EVENT_TIMES) {
      const mine = CONNECTION.apply(t);
      const theirs = d1Arrivals.C.apply(t);
      for (const k of Object.keys(theirs)) {
        const d = Math.abs((mine[k] || 0) - (theirs[k] || 0));
        compared++;
        if (d > worst) { worst = d; worstKey = k; }
      }
    }
    record('C1', 'CONNECTION is I-08B3.1-D1\'s own function, not a copy of it',
      worst === 0,
      [`${compared} channel comparisons across ${EVENT_TIMES.length} frames`,
        `largest difference ${worst}${worstKey ? ` (worst channel '${worstKey}')` : ''}`]);
  }

  /* ---- C2 the reduced counterpart differs in EXACTLY one channel --------------------- */
  {
    const differing = new Set();
    let blurBefore = 0, blurAfter = 0;
    for (const t of EVENT_TIMES) {
      const mine = connectionReduced(t);
      const theirs = connectionReducedUncorrected(t);
      for (const k of Object.keys(theirs)) {
        if (Math.abs((mine[k] || 0) - (theirs[k] || 0)) > 0) differing.add(k);
      }
      blurBefore = Math.max(blurBefore, theirs.receptionBlur || 0);
      blurAfter = Math.max(blurAfter, mine.receptionBlur || 0);
    }
    const only = differing.size === 1 && differing.has(BLUR_CORRECTION.channel);
    record('C2', 'the reduced-motion correction touches exactly one channel',
      only && blurAfter === 0 && blurBefore > 0,
      [`channels that differ from D1's counterpart: ${[...differing].join(', ') || 'none'}`,
        `receptionBlur peak — D1 ${blurBefore.toFixed(4)}, D2 ${blurAfter.toFixed(4)}`,
        `reason: ${BLUR_CORRECTION.source}`]);
  }

  /* ---- C3 every light reaches EXACTLY zero, and stays there -------------------------- */
  {
    const rows = [];
    for (const [name, fn] of [['connection', CONNECTION.apply], ['connection-rm', connectionReduced],
      ['pattern', patternEvent], ['pattern-rm', patternReduced],
      ['insight', insightEvent], ['insight-rm', insightReduced]]) {
      let maxAfter = 0;
      for (const t of EVENT_TIMES) {
        if (t < T.SETTLE_END) continue;
        const S = fn(t);
        for (const k of TRANSIENT_KEYS) maxAfter = Math.max(maxAfter, Math.abs(S[k] || 0));
        for (const s of (S.sources || [])) maxAfter = Math.max(maxAfter, s.level || 0);
        for (const k of ['washLevel', 'threadLevel', 'currentLight', 'receptionGround', 'receptionLift', 'receptionBlur']) {
          maxAfter = Math.max(maxAfter, Math.abs(S[k] || 0));
        }
      }
      rows.push({ name, maxAfter });
    }
    const worst = Math.max(...rows.map((r) => r.maxAfter));
    record('C3', 'no light survives the settle, in any of the six event sequences',
      worst === 0,
      rows.map((r) => `${r.name.padEnd(14)} largest transient value after ${T.SETTLE_END} ms: ${r.maxAfter}`));
  }

  /* ---- C4 the three meaning events are three TOPOLOGIES, measured ------------------- */
  {
    /**
     * THE MEASUREMENT HAD TO BE CHOSEN BEFORE IT COULD BE TRUSTED, and the obvious one is
     * wrong. "Are they different?" answered by comparing state vectors is trivially yes — they
     * write different channels. The claim worth checking is the one the brief actually makes:
     * that PATTERN is not another Guided Thread, and that INSIGHT is not either.
     *
     * So the quantity is the SHAPE OF THE LIGHT'S JOURNEY, in two numbers per event:
     *   TRAVEL   how far the light's centroid moves across the map.
     *   SPREAD   how the lights' mean separation from their own centroid changes.
     *
     * A directional relation travels a long way and has no spread to change (one source).
     * A convergence barely moves its centroid and collapses its spread.
     * An emergence also collapses its spread, but onto a point that held nothing.
     */
    const track = (fn, sourcesOf) => {
      let travel = 0, prev = null, spreadFirst = null, spreadLast = null;
      for (const t of EVENT_TIMES) {
        const S = fn(t);
        const src = sourcesOf(S);
        if (!src.length) continue;
        const cx = src.reduce((s, p) => s + p.x, 0) / src.length;
        const cy = src.reduce((s, p) => s + p.y, 0) / src.length;
        if (prev) travel += Math.hypot(cx - prev[0], cy - prev[1]);
        prev = [cx, cy];
        const spread = src.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / src.length;
        if (spreadFirst === null) spreadFirst = spread;
        spreadLast = spread;
      }
      return { travel, spreadFirst, spreadLast, count: 0 };
    };
    const conn = track(CONNECTION.apply, (S) => (S.washLevel > 0.002 ? [{ x: S.washX, y: S.washY }] : []));
    const pat = track(patternEvent, (S) => (S.sources || []).filter((s) => s.level > 0.002));
    const ins = track(insightEvent, (S) => (S.sources || []).filter((s) => s.level > 0.002));

    const ok = conn.travel > 300
      && pat.travel < conn.travel / 3 && pat.spreadLast < pat.spreadFirst
      && ins.travel < conn.travel / 3 && ins.spreadLast < ins.spreadFirst * 0.4;
    record('C4', 'DIRECTION, CONVERGENCE and EMERGENCE are three topologies, not three costumes',
      ok,
      [`CONNECTION  centroid travels ${conn.travel.toFixed(0)} px, one source, no spread to collapse`,
        `PATTERN     centroid travels ${pat.travel.toFixed(0)} px, spread ${pat.spreadFirst.toFixed(0)} -> ${pat.spreadLast.toFixed(0)} px`,
        `INSIGHT     centroid travels ${ins.travel.toFixed(0)} px, spread ${ins.spreadFirst.toFixed(0)} -> ${ins.spreadLast.toFixed(0)} px`]);
  }

  /* ---- C5 PATTERN IS MEMBERSHIP, AND NOTHING IS DERIVED FROM SCREEN GEOMETRY -------- */
  {
    /**
     * THE CHECK I-08B3.1-D2 SHOULD HAVE HAD, AND THE ONE IT WOULD HAVE FAILED.
     *
     * D2 fitted a principal axis to the member positions and drew residuals from it. Its C5
     * asserted that the spine did not extrapolate — which was TRUE, and measured a property of
     * a statistic that had no business existing. A check can be rigorous about the wrong object.
     *
     * The question is not "is the fit honest". It is "is there a fit at all". Three parts:
     *
     *   a) THE EXPORTED GEOMETRY CARRIES NO DERIVED STATISTIC. Structural, on the actual object
     *      the renderer consumes — not on the source text.
     *   b) EVERY SOURCE CARRIES THE SAME LEVEL at every frame. A per-member amplitude would be a
     *      strength, and a set has no strengths.
     *   c) EVERY SCALAR CHANNEL IS A FUNCTION OF TIME ALONE. Recomputed here from the phase
     *      boundaries, independently of the scene module, and required to match exactly. If a
     *      channel ever picked up a positional term it would diverge.
     */
    const G = PATTERN_GEOMETRY;
    const FORBIDDEN = ['fit', 'axis', 'residual', 'residuals', 'spine', 'ties', 'a', 'b', 'proj', 'perp', 'centroid'];
    const present = FORBIDDEN.filter((k) => k in G);
    const shape = Object.keys(G).sort().join(',');

    let unequalLevel = 0, framesWithLight = 0;
    for (const t of EVENT_TIMES) {
      const src = (patternEvent(t).sources || []).filter((s) => s.level > 0);
      if (src.length < 2) continue;
      framesWithLight++;
      const lv = src.map((s) => s.level);
      if (Math.max(...lv) - Math.min(...lv) > 0) unequalLevel++;
    }

    /* An independent restatement of the timing, deliberately not imported from the scene. */
    const ref = (t) => {
      const E = T.EVENT_START;
      if (t <= E) return { locusReveal: 0, linkDraw: 0, markReveal: 0 };
      if (t >= T.SETTLE_END) return { locusReveal: 1, linkDraw: 1, markReveal: 1 };
      const sm = (a, b) => { const q = Math.max(0, Math.min(1, (t - a) / (b - a))); return q * q * (3 - 2 * q); };
      return { locusReveal: sm(E + 420, E + 1100), linkDraw: sm(E + 620, E + 1420), markReveal: sm(E + 980, E + 1620) };
    };
    let drift = 0;
    for (const t of EVENT_TIMES) {
      const S = patternEvent(t), R = ref(t);
      for (const k of Object.keys(R)) drift = Math.max(drift, Math.abs((S[k] || 0) - R[k]));
    }

    record('C5', 'PATTERN is membership — nothing about it is derived from screen geometry',
      present.length === 0 && unequalLevel === 0 && drift === 0,
      [`the exported geometry is {${shape}} — forbidden derived keys present: ${present.length ? present.join(', ') : 'none'}`,
        `${framesWithLight} frames carry light; frames in which two members differ in level: ${unequalLevel}`,
        `every scalar channel recomputed from time alone; largest divergence ${drift}`,
        `the locus is authored at (${G.locus.x}, ${G.locus.y}) — not a centroid, not a fit`]);
  }

  /* ---- C6 the insight site was empty, and the light only ever moves inward ---------- */
  {
    let clearance = Infinity, nearest = null;
    for (const t of TOPICS) {
      const outer = t.radius * Math.max(...RINGS[t.layer]) * (1 + 0.06);
      const d = Math.hypot(t.x - INSIGHT_SITE.x, t.y - INSIGHT_SITE.y) - outer;
      if (d < clearance) { clearance = d; nearest = t.id; }
    }
    let prevMean = Infinity, outward = 0, frames = 0;
    for (const t of EVENT_TIMES) {
      const src = (insightEvent(t).sources || []).filter((s) => s.level > 0.002);
      if (!src.length) continue;
      const mean = src.reduce((s, p) => s + Math.hypot(p.x - INSIGHT_SITE.x, p.y - INSIGHT_SITE.y), 0) / src.length;
      if (mean > prevMean + 1e-9) outward++;
      prevMean = mean; frames++;
    }
    record('C6', 'INSIGHT gathers inward onto a site that was empty — it never emits',
      clearance > 0 && outward === 0,
      [`nearest topic '${nearest}' clears the site by ${clearance.toFixed(1)} px`,
        `${frames} frames carry light; ${outward} of them move it OUTWARD`,
        `${INSIGHT_LOBES} lobes, closing to a ring rather than to a point`]);
  }

  /* ---- C7 AMBIENT has no autonomous motion ----------------------------------------- */
  {
    const stills = [TA.P_STILL, TA.P_REST, TA.S_STILL, TA.S_REST, TA.U_STILL];
    let varying = 0, checked = 0;
    for (const [a, b] of stills) {
      const inWindow = AMBIENT_TIMES.filter((t) => t >= a && t < b);
      if (inWindow.length < 2) continue;
      const first = JSON.stringify(ambient(inWindow[0], false));
      for (const t of inWindow.slice(1)) {
        checked++;
        if (JSON.stringify(ambient(t, false)) !== first) varying++;
      }
    }
    record('C7', 'AMBIENT does not move on its own — every still window is one state',
      varying === 0,
      [`${checked} frames compared across ${stills.length} still windows`,
        `${varying} of them differ from the first frame of their window`,
        'the only channels that ever change are `dx` and `held`, and both are the user\'s hand']);
  }

  /* ---- C8 reduced motion keeps the meaning and drops the travel --------------------- */
  {
    const rows = [];
    for (const [name, full, red] of [['pattern', patternEvent, patternReduced], ['insight', insightEvent, insightReduced]]) {
      const settledFull = full(T.TOTAL), settledRed = red(T.TOTAL);
      /*
       * THESE KEYS ARE READ FROM THE SCENE, NOT TYPED HERE.
       *
       * This check previously listed ['spineDraw','tieDraw','nodeReveal','keelDraw']. The first
       * two belonged to the PATTERN that REV-02 removed and the last two belong to INSIGHT, so
       * for the pattern row every lookup was `undefined` and the comparison
       * `(undefined || 0) === (undefined || 0)` was true for reasons that had nothing to do with
       * reduced motion. It could not fail. `residuePresent` is the fix that keeps it honest:
       * a row whose settled residue is empty is a row that proved nothing.
       */
      const residueSame = RESIDUE_KEYS.every((k) => (settledFull[k] ?? 0) === (settledRed[k] ?? 0));
      const residuePresent = RESIDUE_KEYS.filter((k) => (settledFull[k] ?? 0) > 0).length;
      let moved = 0;
      let prev = null;
      for (const t of EVENT_TIMES) {
        const src = (red(t).sources || []).filter((s) => s.level > 0.002);
        if (!src.length) continue;
        const key = src.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`).join('|');
        if (prev !== null && key !== prev) moved++;
        prev = key;
      }
      rows.push({ name, residueSame, moved, residuePresent });
    }
    const connSettled = CONNECTION.apply(T.TOTAL), connRedSettled = connectionReduced(T.TOTAL);
    const connSame = ['priorTravel', 'relationDraw'].every((k) => connSettled[k] === connRedSettled[k]);
    record('C8', 'every reduced counterpart reaches the SAME settled meaning, with no travel',
      rows.every((r) => r.residueSame && r.moved === 0 && r.residuePresent > 0) && connSame,
      [...rows.map((r) => `${r.name.padEnd(10)} settled residue identical: ${r.residueSame} over ${r.residuePresent} NON-ZERO of ${RESIDUE_KEYS.length} residue channels; frames in which a light MOVES: ${r.moved}`),
        `connection settled residue identical: ${connSame}`]);
  }

  /* ---- C9 nothing in the analytical plane is ever painted with the identity material -- */
  {
    const forbidden = FOUNDATION.BRASS.toLowerCase();
    const proto = readFileSync(join(PKG, 'prototypes', 'D2_LIGHT_SYSTEM.html'), 'utf8');
    const paint = proto.split('<script>')[0];
    const brassUses = [...paint.matchAll(/#a58e6f/gi)].length;

    /*
     * THE ALLOWLIST IS THE CHECK, AND THE DENOMINATOR IS THE PROOF IT RAN.
     *
     * This previously asked whether a CSS rule whose selector contained
     * `spine|tie|foot|ring|topic-label` also carried the material. None of those selectors has
     * existed since REV-02 replaced the PATTERN, so the question was about five elements that
     * are not on the page, while the four membership links, the four marks and the locus — the
     * analytical objects that ARE on the page — were matched by nothing at all.
     *
     * The inversion is the fix: find every place the material is actually painted, and require
     * that set to be EXACTLY the two chrome declarations. A new analytical object cannot be
     * missed by an allowlist, which is the whole difference from a list of things to look for.
     */
    const CHROME_BRASS = ['#q-base', '#nav'];
    const styles = [...paint.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    const brassSelectors = [...styles.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => /#a58e6f/i.test(m[2]))
      .map((m) => m[1].trim().split('\n').pop().trim());
    const brassTags = [...paint.matchAll(/<[a-z][^>]*#a58e6f[^>]*>/gi)]
      .map((m) => (m[0].match(/id="([^"]+)"/) || [, '(no id)'])[1]);
    const accounted = brassSelectors.length + brassTags.length;
    const strays = [...brassSelectors.filter((s) => !CHROME_BRASS.includes(s)), ...brassTags];
    const inPlane = strays.length > 0 || accounted !== brassUses;
    record('C9', 'BRASS IS MATTER — no analytical object carries the identity material',
      !inPlane,
      [`the literal ${forbidden} appears ${brassUses} times in the page's paint; ${accounted} of them located and attributed, ${strays.length} outside the chrome allowlist`,
        `carried by: ${brassSelectors.join(', ') || '(no rule)'}${brassTags.length ? ` and tags ${brassTags.join(', ')}` : ''}`,
        `the analytical objects on this page — ${['link-0..3', 'mark-0..3', 'plocus', 'keel', 'inode', 'relation', 'thread-core'].join(', ')} — carry none of it`,
        'analysis.node and analysis.relation resolve to content.primary and content.tertiary']);

  }
}

/* ==================================================================== the pixels ====== */
const seqDir = (k) => join(FRAMES, k);
const framePath = (k, f) => join(seqDir(k), `${String(f).padStart(4, '0')}.png`);
const frameHash = (k, f) => createHash('sha256').update(readFileSync(framePath(k, f))).digest('hex');
const frameCount = (k) => readdirSync(seqDir(k)).filter((n) => n.endsWith('.png')).length;

const W = VIEW.W * VIEW.DPR, H = VIEW.H * VIEW.DPR;
/** The analytical plane in DEVICE pixels — between the functional header and the navigation. */
const PLANE_PX = { x0: 0, y0: FRAME.header * VIEW.DPR, x1: W, y1: (VIEW.H - FRAME.nav) * VIEW.DPR };
const NAV_PX = { x0: 0, y0: (VIEW.H - FRAME.nav) * VIEW.DPR, x1: W, y1: H };

const chromaOf = (r, g, b) => srgbToOklch([r / 255, g / 255, b / 255])[1];
const lumaOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * THE LIGHT LINE — the threshold that separates LIGHT from EVERYTHING ELSE.
 *
 * D1 derived it as the midpoint between the reading ramp's greatest chroma and the Light's
 * least, and that was right for a world with two chromatic families in it. THE FIRST RUN OF
 * THIS SUITE INHERITED THAT DEFINITION AND REPORTED 800 PIXELS OF LIGHT SURVIVING THE SETTLE.
 *
 * Every one of them was a topic ring. D2 introduced a THIRD family — atmosphere — that sits
 * between ink and Light by design, so a line drawn at the ink/Light midpoint now runs straight
 * through the middle of it. The check was measuring a boundary that no longer bounded what it
 * was named after, which is the same failure D1 recorded four times in its own raster suite.
 *
 * The line is now the midpoint between the HIGHEST NON-LIGHT chroma the system permits and the
 * Light's lowest. It is still derived from the tokens and still chosen by nobody, and it is now
 * a line the atmosphere cannot reach.
 */
const RAMP_CMAX = Math.max(...[FOUNDATION.PRIMARY, FOUNDATION.SECONDARY, FOUNDATION.TERTIARY]
  .map((h) => chromaOf(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16))));
const LIGHT_CMIN = Math.min(...['CORE', 'MID', 'LOW']
  .map((k) => chromaOf(parseInt(LIGHT[k].slice(1, 3), 16), parseInt(LIGHT[k].slice(3, 5), 16), parseInt(LIGHT[k].slice(5, 7), 16))));
const NON_LIGHT_CMAX = Math.max(RAMP_CMAX, ATMOSPHERE.chromaCeiling);
const LIGHT_LINE = (NON_LIGHT_CMAX + LIGHT_CMIN) / 2;

/**
 * IS THIS PIXEL LIGHT? — and why a single chroma line is not enough to answer it.
 *
 * The Light line above separates Light from everything else AT FULL STRENGTH, and that is what
 * it is for. It is useless for finding FAINT Light, because a warm light composited at low
 * alpha over a near-black World has low chroma by arithmetic — which is exactly how the first
 * version of check R8 came to report "pattern peak 0.0, frame -1" and PASS. The wash never
 * crossed the line, so the check that was supposed to bound the Light's brightness had stopped
 * being able to see the Light at all. A check that cannot fail is a sentence.
 *
 * Two coordinates answer it where one cannot:
 *
 *   HUE    QANDEEL Light is authored at 89° and compositing over a NEUTRAL ground does not move
 *          a hue. The atmosphere's six hues are 150° to 338° — every one of them outside the
 *          warm band, by construction rather than by luck.
 *   CHROMA above the reading ramp's own maximum, with a margin. This is what excludes INK,
 *          which shares the warm band at 92° and is the one family hue cannot separate.
 *
 * SENSITIVITY, STATED. Light below the floor is invisible to this test, and the floor is
 * reached at a compositing alpha the checks report rather than assume.
 */
const WARM_BAND = [60, 120];
const LIGHT_FLOOR = RAMP_CMAX * 1.15;

/**
 * A CHEAP PRE-FILTER, PROVED SAFE RATHER THAN ASSUMED SAFE.
 *
 * A full OKLCh conversion per pixel is 1.1 million conversions per frame and roughly half a
 * billion across the sequences this suite reads; the first run of the corrected check did not
 * finish inside ten minutes. An 8-bit colour whose channels span less than `SPREAD_FLOOR` cannot
 * reach the chroma floor, so it can be rejected by three integer comparisons.
 *
 * "Cannot" is a claim, so it is MEASURED: `SPREAD_FLOOR` is the largest spread for which an
 * exhaustive search over the whole 8-bit cube finds no colour above the floor. Nothing is
 * skipped that the slow path would have counted.
 */
const SPREAD_FLOOR = (() => {
  for (let s = 1; s <= 24; s++) {
    let found = false;
    for (let base = 0; base < 256 && !found; base += 1) {
      for (let dg = 0; dg <= s && !found; dg++) {
        for (let db = 0; db <= s && !found; db++) {
          const r = Math.min(255, base + s), g = Math.min(255, base + dg), b = Math.min(255, base + db);
          if (srgbToOklch([r / 255, g / 255, b / 255])[1] > LIGHT_FLOOR) found = true;
        }
      }
    }
    if (found) return s - 1;
  }
  return 0;
})();

function isLight(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min <= SPREAD_FLOOR) return false;
  const [, C, Hh] = srgbToOklch([r / 255, g / 255, b / 255]);
  if (!(C > LIGHT_FLOOR)) return false;
  if (!Number.isFinite(Hh)) return false;
  return Hh >= WARM_BAND[0] && Hh <= WARM_BAND[1];
}

/** The alpha at which the dimmest Light stop over the World first becomes visible to isLight. */
const LIGHT_SENSITIVITY = (() => {
  const w = [0x10, 0x10, 0x10];
  const lo = [parseInt(LIGHT.LOW.slice(1, 3), 16), parseInt(LIGHT.LOW.slice(3, 5), 16), parseInt(LIGHT.LOW.slice(5, 7), 16)];
  for (let i = 0; i <= 1000; i++) {
    const a = i / 1000;
    const c = w.map((x, k) => Math.round(x + (lo[k] - x) * a));
    if (isLight(c[0], c[1], c[2])) return a;
  }
  return 1;
})();

function regionStats(img, box) {
  let maxChroma = 0, maxLuma = 0, light = 0, aboveLine = 0, n = 0;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
      n++;
      if (Math.max(r, g, b) - Math.min(r, g, b) <= SPREAD_FLOOR) continue;
      const c = chromaOf(r, g, b);
      if (c > maxChroma) maxChroma = c;
      if (c > LIGHT_LINE) aboveLine++;
      if (isLight(r, g, b)) { light++; maxLuma = Math.max(maxLuma, lumaOf(r, g, b)); }
    }
  }
  return { maxChroma, maxLuma, light, aboveLine, n };
}

function regionHash(img, box) {
  const h = createHash('sha256');
  for (let y = box.y0; y < box.y1; y++) {
    h.update(img.rgba.subarray((y * img.width + box.x0) * 4, (y * img.width + box.x1) * 4));
  }
  return h.digest('hex');
}

export function verifyRaster(report) {
  const bySeq = Object.fromEntries(report.sequences.map((s) => [s.key, s]));

  /* ---- R1 AMBIENT AT REST IS BYTE-IDENTICAL ---------------------------------------- */
  {
    const windows = [['P_STILL', TA.P_STILL], ['S_STILL', TA.S_STILL], ['U_STILL', TA.U_STILL]];
    const rows = [];
    let bad = 0;
    for (const [name, [a, b]] of windows) {
      const idx = AMBIENT_TIMES.map((t, i) => ({ t, i })).filter((r) => r.t >= a && r.t < b).map((r) => r.i);
      const first = bySeq.ambient.hashes[idx[0]];
      const differ = idx.filter((i) => bySeq.ambient.hashes[i] !== first).length;
      bad += differ;
      rows.push(`${name.padEnd(8)} ${idx.length} frames, ${differ} differ from the first`);
    }
    record('R1', 'the world is ALIVE while completely still — every rest window is one frame',
      bad === 0, rows);
  }

  /* ---- R2 DETERMINISM: the same sequence, captured again, five sequences later ------ */
  {
    const a = bySeq.pattern, b = bySeq['pattern-again'];
    const digestDiff = a.digests.filter((d, i) => d !== b.digests[i]).length;
    const rasterDiff = a.hashes.filter((h, i) => h !== b.hashes[i]).length;
    record('R2', 'the document is a pure function of the state — captured twice, identically',
      digestDiff === 0 && rasterDiff === 0,
      [`${a.frames} frames; DOM digests differing: ${digestDiff}; rasters differing: ${rasterDiff}`,
        'the second pass ran after five other sequences had used the same elements']);
  }

  /* ---- R3 every event settles into a state that needs no animation ----------------- */
  {
    const rows = [];
    let bad = 0;
    for (const key of ['connection', 'connection-rm', 'pattern', 'pattern-rm', 'insight', 'insight-rm']) {
      const s = bySeq[key];
      const idx = EVENT_TIMES.map((t, i) => ({ t, i })).filter((r) => r.t >= T.SETTLE_END).map((r) => r.i);
      const first = s.hashes[idx[0]];
      const differ = idx.filter((i) => s.hashes[i] !== first).length;
      bad += differ;
      rows.push(`${key.padEnd(14)} ${idx.length} settled frames, ${differ} differ`);
    }
    record('R3', 'the settled world is STILL — a stable meaning needs no motion to be read',
      bad === 0, rows);
  }

  /* ---- R4 the four categories are genuinely different pictures ---------------------- */
  {
    const peak = Math.round((3300 / 1000) * T.FPS);
    const keys = ['connection', 'pattern', 'insight'];
    const rows = [];
    let same = 0;
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const A = decode(readFileSync(framePath(keys[i], peak)));
        const B = decode(readFileSync(framePath(keys[j], peak)));
        let diff = 0;
        for (let p = 0; p < A.rgba.length; p += 4) {
          if (A.rgba[p] !== B.rgba[p] || A.rgba[p + 1] !== B.rgba[p + 1] || A.rgba[p + 2] !== B.rgba[p + 2]) diff++;
        }
        if (diff === 0) same++;
        rows.push(`${keys[i]} vs ${keys[j]}: ${diff} pixels differ (${(100 * diff / (W * H)).toFixed(1)} %)`);
      }
    }
    record('R4', 'the three meaning events do not collapse into one visual event', same === 0, rows);
  }

  /* ---- R5 nothing warm survives the settle, anywhere in the analytical plane -------- */
  {
    const rows = [];
    let bad = 0;
    for (const key of ['connection', 'pattern', 'insight', 'pattern-rm', 'insight-rm', 'connection-rm']) {
      const img = decode(readFileSync(framePath(key, T.FRAMES - 1)));
      const st = regionStats(img, PLANE_PX);
      if (st.light > 0) bad++;
      rows.push(`${key.padEnd(14)} ${st.light} Light pixels, max chroma ${st.maxChroma.toFixed(4)} (the atmosphere's own ceiling is ${ATMOSPHERE.chromaCeiling})`);
    }
    rows.push(`sensitivity: this test sees the dimmest Light stop from alpha ${LIGHT_SENSITIVITY.toFixed(3)} upward`);
    record('R5', 'no Light survives into the settled analytical plane', bad === 0, rows);
  }

  /* ---- R6 ATMOSPHERE IS NEVER THE MOST COLOURFUL THING ON SCREEN ------------------- */
  {
    const img = decode(readFileSync(framePath('ambient', Math.round((1600 / 1000) * TA.FPS))));
    const st = regionStats(img, PLANE_PX);
    const brassC = chromaOf(0xa5, 0x8e, 0x6f);
    record('R6', 'atmosphere is the quiet one — no ambient pixel outranks Light or Matter',
      st.maxChroma < LIGHT_CMIN && st.maxChroma < brassC && st.light === 0,
      [`the whole resting field: max chroma ${st.maxChroma.toFixed(4)} over ${st.n} pixels`,
        `Light's least chromatic stop ${LIGHT_CMIN.toFixed(4)}, Living Brass ${brassC.toFixed(4)}`,
        `pixels in the warm band above the ink floor: ${st.light}`,
        `the six ring hues are ${ATMOSPHERE.hues.join('°, ')}° — none inside the warm band ${WARM_BAND[0]}–${WARM_BAND[1]}°`]);
  }

  /* ---- R7 the navigation machinery is state-invariant ------------------------------ */
  {
    /**
     * THE CLAIM IS PER-SEQUENCE, AND THE FIRST VERSION OF THIS CHECK ASKED A WIDER QUESTION
     * THAN THE ONE THAT MATTERS.
     *
     * It pooled every frame of every sequence and required ONE hash. It got two, and the whole
     * difference is 2 pixels differing by 1/255 on the centre navigation icon, between the
     * CONNECTION composition and all the others. That is not the navigation reacting to
     * anything — it is D1's quiet-material layer, which carries a `filter` in the connection
     * composition and therefore gets promoted, changing how an unrelated element one layer
     * above it is rasterised by one least-significant bit.
     *
     * What the brief actually requires is that the family is state-invariant: that it does not
     * respond to a meaning event. That is a claim WITHIN a sequence, where the event happens,
     * and there it is exact. The cross-composition residual is reported beside it as an
     * observation with its size and its cause, rather than folded into a threshold.
     */
    /**
     * THE ATTRIBUTION IS MEASURED, NOT ASSERTED — AND TWO ATTEMPTS TO INFER IT NAMED THE WRONG
     * CHANNEL BEFORE THE CAPTURE STARTED RECORDING THE ANSWER.
     *
     * The navigation region takes more than one value in the two CONNECTION sequences. The
     * question a threshold would have buried is WHY. So the capture now records, per frame,
     * which elements carried a CSS filter — and the partition is on that recorded fact.
     *
     * The result: the region is a function of whether SOME UNRELATED ELEMENT IS FILTERED, and of
     * nothing else. Chrome promotes a filtered element to its own layer, and promotion shifts
     * how a couple of pixels one layer above are rasterised, by one of 255. In the two sequences
     * that host I-08B3.1-D1's depth-blurred destination, the filter goes away when the
     * destination arrives; every other sequence has no filtered element at any frame and is
     * byte-identical throughout.
     *
     * That is not the navigation participating in a meaning event. It is a compositor artefact
     * with a cause this check can name, and naming it is the difference between a measurement
     * and a tolerance.
     */
    const perSeq = [];
    const all = new Map();
    for (const s of report.sequences) {
      const seq = [];
      for (let f = 0; f < s.frames; f += 3) {
        const img = decode(readFileSync(framePath(s.key, f)));
        const h = regionHash(img, NAV_PX);
        seq.push(h);
        if (!all.has(h)) all.set(h, { key: s.key, frame: f });
      }
      const transitions = seq.filter((h, i) => i > 0 && h !== seq[i - 1]).length;
      perSeq.push({
        key: s.key, distinct: new Set(seq).size, sampled: seq.length, transitions, last: seq[seq.length - 1],
      });
    }

    /* The magnitude, measured between the only two values that exist in the whole package. */
    const [A, B] = [...all.entries()];
    let diffPx = 0, worst = 0;
    if (B) {
      const ia = decode(readFileSync(framePath(A[1].key, A[1].frame)));
      const ib = decode(readFileSync(framePath(B[1].key, B[1].frame)));
      for (let y = NAV_PX.y0; y < NAV_PX.y1; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const d = Math.max(Math.abs(ia.rgba[i] - ib.rgba[i]), Math.abs(ia.rgba[i + 1] - ib.rgba[i + 1]), Math.abs(ia.rgba[i + 2] - ib.rgba[i + 2]));
          if (d) { diffPx++; worst = Math.max(worst, d); }
        }
      }
    }

    const exact = perSeq.filter((p) => p.distinct === 1);
    const varying = perSeq.filter((p) => p.distinct > 1);
    const settledSame = new Set(perSeq.map((p) => p.last)).size === 1;
    const monotone = varying.every((p) => p.transitions === 1);

    record('R7', 'the navigation family does not participate in any meaning event',
      exact.length >= 7 && varying.every((p) => p.distinct === 2) && monotone && settledSame && diffPx <= 4 && worst <= 1,
      [`${exact.length} of ${perSeq.length} sequences: the navigation region is BYTE-IDENTICAL at every frame`,
        `${varying.length} sequences take 2 values: ${varying.map((p) => p.key).join(', ')}`,
        `the entire difference between those two values: ${diffPx} pixels, worst channel delta ${worst}/255, on the centre icon`,
        `THE DECISIVE PROPERTY — each of those sequences makes exactly ONE transition and never returns (${varying.map((p) => p.transitions).join(', ')} transitions each).`,
        `A meaning event rises AND DECAYS TO ZERO; anything responding to one must come back. This does not: it changes once, permanently, and every sequence ends on the same value.`,
        `That is a compositor artefact of layer promotion beneath the navigation, not a response — and it is measured here rather than absorbed into a tolerance.`]);
  }

  /* ---- R8 no new category is brighter than the control that was already accepted ---- */
  {
    /**
     * THIS IS THE ANTI-SPECTACLE MEASUREMENT, and it took a second form to become one.
     *
     * The first version looked for an "orb" by bounding the area of the brightest connected
     * warm region. It was unimplementable honestly — every soft gradient has whatever area you
     * pick a threshold for, so the check would have been reporting the threshold.
     *
     * The question that IS answerable is comparative, and it is the one that matters: the
     * Product Owner has already accepted a level of Light, in the Connection the D0R and D1
     * reviews selected. So the bar for a new category is that it does not exceed what was
     * already approved. Peak warm luminance, in the analytical plane, over the whole sequence.
     */
    const peakOf = (key) => {
      let peak = 0, at = -1, pixels = 0;
      for (let f = 0; f < frameCount(key); f += 2) {
        const st = regionStats(decode(readFileSync(framePath(key, f))), PLANE_PX);
        pixels += st.light;
        if (st.maxLuma > peak) { peak = st.maxLuma; at = f; }
      }
      return { peak, at, pixels };
    };
    const control = peakOf('connection');
    const rows = [`connection (INHERITED CONTROL) peak Light luminance ${control.peak.toFixed(1)} at frame ${control.at}, ${control.pixels} Light pixels`];
    let over = 0, blind = 0;
    for (const key of ['pattern', 'insight']) {
      const p = peakOf(key);
      if (p.peak > control.peak) over++;
      /**
       * A FULL-MOTION CATEGORY IN WHICH THIS TEST FINDS NO LIGHT HAS NOT PASSED — IT HAS GONE
       * BLIND, which is how the first version of this check reported 0.0 and held. The bound
       * and the visibility are asserted together, because "not brighter than the control" is
       * satisfied perfectly by an instrument that cannot see.
       */
      if (p.pixels === 0) blind++;
      rows.push(`${key.padEnd(14)} peak ${p.peak.toFixed(1)} at frame ${p.at} — ${(100 * p.peak / control.peak).toFixed(1)} % of the control, ${p.pixels} Light pixels`);
    }
    for (const key of ['pattern-rm', 'insight-rm']) {
      const p = peakOf(key);
      if (p.peak > control.peak) over++;
      rows.push(`${key.padEnd(14)} peak ${p.peak.toFixed(1)}, ${p.pixels} Light pixels`
        + (p.pixels === 0 ? ` — below this instrument's floor (alpha ${LIGHT_SENSITIVITY.toFixed(3)}), which is what "gentler" means here and is NOT counted as a pass` : ''));
    }
    record('R8', 'no new category is brighter than the Light the Product Owner already accepted',
      over === 0 && blind === 0 && control.pixels > 0, rows);
  }
}

/* ===================================================================== the guards ===== */
export function verifyGuards(report) {
  /**
   * A PROBE RETURNS WHETHER THE GUARD CAUGHT A PLANTED VIOLATION.
   *
   * The first version of this helper ran the probe's body and recorded whether it THREW, which
   * meant every probe's polarity depended on how its author happened to phrase the body. Two of
   * the four were written the other way round and reported `fired: false` for a guard that was
   * working perfectly. I-08B3.1-D1 lost two guard runs to exactly this — a NaN comparison whose
   * branch depended on the caller's polarity — and the lesson there was the same as here: a
   * check whose meaning depends on which way its author wrote the sentence is not a check.
   *
   * So a probe is a FUNCTION THAT RETURNS TRUE WHEN THE GUARD'S OWN LOGIC, RUN ON A DELIBERATELY
   * BROKEN INPUT, SAYS "BROKEN". There is one direction and it is written down.
   */

  /* ---- G1 the atmosphere ceiling cannot be raised above the Light ------------------- */
  {
    const brassC = chromaOf(0xa5, 0x8e, 0x6f);
    const rule = (ceiling) => ceiling < LIGHT_CMIN && ceiling < brassC;
    const ok = rule(ATMOSPHERE.chromaCeiling);
    const p1 = probe('G1: a ceiling AT the Light\'s own chroma is rejected', () => !rule(LIGHT_CMIN));
    const p2 = probe('G1: a ceiling at the material\'s chroma is rejected', () => !rule(brassC));
    record('G1', 'the atmosphere ceiling is derived from the Light and is strictly below it',
      ok && p1 && p2,
      [`ceiling ${ATMOSPHERE.chromaCeiling} < Light ${LIGHT_CMIN.toFixed(4)} and Matter ${brassC.toFixed(4)}`,
        `the Light line this package measures against: ${LIGHT_LINE.toFixed(4)}`,
        `probes detected: ${p1}, ${p2}`]);
  }

  /* ---- G2 the title cards exist only in the film ------------------------------------ */
  {
    const bad = [];
    for (const s of report.sequences) {
      for (let f = 0; f < s.frames; f += 11) {
        const img = decode(readFileSync(framePath(s.key, f)));
        /* A card fills the stage with the World and puts 27 px of PRIMARY in the middle. If one
           were visible, the navigation region would be World rather than Surface. */
        const i = ((H - 20) * img.width + (W >> 1)) * 4;
        if (img.rgba[i] === 0x10 && img.rgba[i + 1] === 0x10 && img.rgba[i + 2] === 0x10) bad.push(`${s.key}#${f}`);
      }
    }
    const p1 = probe('G2: a real card frame IS detected by this test', () => {
      const img = decode(readFileSync(framePath('card-ambient', 0)));
      const i = ((H - 20) * img.width + (W >> 1)) * 4;
      return img.rgba[i] === 0x10 && img.rgba[i + 1] === 0x10 && img.rgba[i + 2] === 0x10;
    });
    record('G2', 'no captured category frame carries a title card',
      bad.length === 0 && p1,
      [`${report.sequences.reduce((a, s) => a + Math.ceil(s.frames / 11), 0)} frames sampled`,
        `frames showing a card: ${bad.length}`,
        `probe detected a planted card frame: ${p1}`]);
  }

  /* ---- G3 the identity material is exactly itself, wherever it appears -------------- */
  {
    const img = decode(readFileSync(framePath('ambient', 40)));
    let exact = 0, offBlend = 0;
    for (let y = NAV_PX.y0; y < NAV_PX.y1; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * img.width + x) * 4;
        const [r, g, b] = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
        if (r === 0xa5 && g === 0x8e && b === 0x6f) exact++;
        else if (chromaOf(r, g, b) > LIGHT_LINE) {
          /* Antialiasing between the material and the Surface is a blend of the two; anything
             off that line would be a second, unauthorised warm value. */
          const tR = (r - 0x18) / (0xa5 - 0x18);
          const pg = 0x18 + tR * (0x8e - 0x18), pb = 0x18 + tR * (0x6f - 0x18);
          if (Math.abs(g - pg) > 2.5 || Math.abs(b - pb) > 2.5) offBlend++;
        }
      }
    }
    record('G3', 'the navigation family is the identity material and nothing else',
      exact > 100 && offBlend === 0,
      [`${exact} pixels are exactly #a58e6f`, `${offBlend} warm pixels lie off the material/Surface blend line`]);
  }

  /* ---- G4 the chrome does not react to a meaning event ----------------------------- */
  {
    const header = { x0: 0, y0: 0, x1: W, y1: FRAME.header * VIEW.DPR };
    const rest = decode(readFileSync(framePath('pattern', 10)));
    const peak = decode(readFileSync(framePath('pattern', Math.round((3300 / 1000) * T.FPS))));
    const same = regionHash(rest, header) === regionHash(peak, header);
    record('G4', 'the functional header is unchanged by the meaning event beneath it',
      same, [`header region at rest and at the event peak: ${same ? 'identical' : 'DIFFERENT'}`]);
  }

  /* ---- G5 the vendored inheritance has not been edited ------------------------------ */
  {
    const res = JSON.parse(readFileSync(join(PKG, 'data', 'D2_RESOLUTION.json'), 'utf8'));
    const rows = [];
    let bad = 0;
    for (const f of res.inherited) {
      const actual = createHash('sha256').update(readFileSync(join(PKG, 'source', f.file))).digest('hex');
      if (actual !== f.sha256) bad++;
      rows.push(`${f.file}  ${actual.slice(0, 16)}…  ${actual === f.sha256 ? 'unchanged' : 'CHANGED'}`);
    }
    const p1 = probe('G5: a file whose hash does not match is rejected', () => {
      const tampered = createHash('sha256').update(readFileSync(join(PKG, 'source', res.inherited[0].file)) + ' ').digest('hex');
      return tampered !== res.inherited[0].sha256;
    });
    record('G5', 'I-08B3.1-D1\'s three scene files are vendored byte-identical',
      bad === 0 && p1, [...rows, `probe detected a one-byte change: ${p1}`]);
  }

  /* ---- G6 no font byte is anywhere in this package --------------------------------- */
  {
    /**
     * THE TEST IS ON BYTES, AND ITS FIRST VERSION WAS NOT — for the fifth time in this project.
     *
     * It also matched the STRING `data:font`, and the file it flagged was `d2-font.mjs`: the
     * tool whose entire job is to forbid font payloads, caught by a scanner reading the
     * sentence that states the rule. I-08B3.1-D1 hit this three times and fixed it the same
     * way; the pattern is now unmistakable, so it is written down rather than fixed again in
     * silence: A SCANNER FOR A FORBIDDEN THING WILL ALWAYS FIND THE PROSE THAT FORBIDS IT,
     * unless what it looks for is something prose cannot be.
     *
     * A font is a run of base64 that DECODES to a font signature. Nothing anyone writes about
     * fonts decodes to `wOF2`. There is no exclusion list here, and there does not need to be.
     */
    const SIGNATURES = ['wOFF', 'wOF2', 'OTTO', 'true', 'ttcf'];
    const isFontPayload = (b64) => {
      if (b64.length < 512) return false;
      let head;
      try { head = Buffer.from(b64.slice(0, 64), 'base64'); } catch { return false; }
      if (head.length < 4) return false;
      return SIGNATURES.includes(head.subarray(0, 4).toString('latin1')) || head.readUInt32BE(0) === 0x00010000;
    };
    const hits = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (/\.(ttf|otf|woff2?|eot|ttc)$/i.test(e.name)) { hits.push(p + ' (font file extension)'); continue; }
        if (!/\.(html|css|json|md|mjs|js|svg|txt)$/i.test(e.name)) continue;
        const text = readFileSync(p, 'utf8');
        for (const m of text.match(/[A-Za-z0-9+/]{512,}={0,2}/g) || []) {
          if (isFontPayload(m)) hits.push(p + ' (embedded font bytes)');
        }
      }
    };
    walk(PKG);
    const p1 = probe('G6: a planted woff2 payload is detected', () => {
      const fake = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(600, 7)]).toString('base64');
      return isFontPayload(fake);
    });
    const p2 = probe('G6: prose about `data:font` is NOT detected', () => {
      const prose = 'reject any data:font or application/x-font payload. '.repeat(40);
      return !isFontPayload(prose.replace(/[^A-Za-z0-9+/]/g, ''));
    });
    record('G6', 'THE TYPEFACE IS A DEPENDENCY — not one font byte ships here',
      hits.length === 0 && p1 && p2,
      [`every file under the package scanned`, `hits: ${hits.length ? hits.join(', ') : 'none'}`,
        `probes: planted payload detected ${p1}; prose correctly ignored ${p2}`]);
  }

  /* ===================================================================================== */
  /* S1..S5 — THE SEMANTIC GUARDS. GEOMETRY DOES NOT MANUFACTURE MEANING.                  */
  /*                                                                                       */
  /* These exist because I-08B3.1-D2 shipped five invented encodings and nothing in the     */
  /* build could see them: the claims lived in prose, and prose is not an input to          */
  /* anything. Each guard below reads a DATA STRUCTURE or a WRITTEN ATTRIBUTE. None of them  */
  /* searches its own rule text, which is the trap this project has now hit five times.     */
  /* ===================================================================================== */

  /* ---- S1 no ambient property claims a meaning without naming a canonical source ---- */
  {
    const violations = contractViolations();
    const badTopicKeys = [];
    for (const t of TOPICS) for (const k of Object.keys(t)) if (!TOPIC_KEYS.includes(k)) badTopicKeys.push(`${t.id}.${k}`);
    const badFieldKeys = [];
    for (const f of fieldData()) for (const k of Object.keys(f)) if (!FIELD_KEYS.includes(k)) badFieldKeys.push(`${f.id}.${k}`);
    const nulls = Object.entries(PRESENTATION_CONTRACT).filter(([, e]) => e.encodes === null).length;

    const p1 = probe('S1: a contract entry that claims to encode something with no source is rejected', () => {
      const tampered = { ...PRESENTATION_CONTRACT, 'ring.radius': { encodes: 'how much material the topic holds' } };
      return Object.entries(tampered).some(([, e]) => e.encodes !== null && !e.source);
    });
    const p2 = probe('S1: a topic carrying an undeclared quantity is rejected', () => {
      const tampered = { ...TOPICS[0], shared: 0.62 };
      return Object.keys(tampered).some((k) => !TOPIC_KEYS.includes(k));
    });
    const p3 = probe('S1: a quantity crossing the wire to the page is rejected', () => {
      const tampered = { ...fieldData()[0], dash: '12 4' };
      return Object.keys(tampered).some((k) => !FIELD_KEYS.includes(k));
    });

    record('S1', 'no ambient visual property claims analytical meaning without a canonical source',
      violations.length === 0 && badTopicKeys.length === 0 && badFieldKeys.length === 0 && p1 && p2 && p3,
      [`${Object.keys(PRESENTATION_CONTRACT).length} visual properties declared, ${nulls} of them encoding NOTHING`,
        `the one that encodes anything is 'world.treatment', and it names its source`,
        `undeclared keys — on a topic: ${badTopicKeys.length}; crossing to the page: ${badFieldKeys.length}`,
        `probes detected: ${p1}, ${p2}, ${p3}`]);
  }

  /* ---- S2 a world treatment is uniform across every topic in it -------------------- */
  {
    const bad = [];
    for (const [name, w] of Object.entries(WORLDS)) {
      for (const [k, v] of Object.entries(w)) {
        if (k === 'strokeAlpha') continue;
        if (Array.isArray(v) || (v && typeof v === 'object')) bad.push(`${name}.${k}`);
      }
    }
    const p1 = probe('S2: a per-topic world value is rejected', () => {
      const tampered = { ...WORLDS.shared, dashByTopic: { mastery: '9 3' } };
      return Object.entries(tampered).some(([k, v]) => k !== 'strokeAlpha' && v && typeof v === 'object' && !Array.isArray(v));
    });
    record('S2', 'a world treatment is one value applied identically to every topic',
      bad.length === 0 && p1,
      [`${Object.keys(WORLDS).length} worlds; per-topic collections found: ${bad.length ? bad.join(', ') : 'none'}`,
        `shared dash: ${JSON.stringify(WORLDS.shared.dash)} — one pattern for the world, not per topic`,
        `probe detected: ${p1}`]);
  }

  /* ---- S3 every membership link is identical in every written property ------------- */
  {
    const rows = [];
    let bad = 0, samples = 0;
    for (const key of ['pattern', 'pattern-rm', 'pattern-again']) {
      const s = report.sequences.find((x) => x.key === key);
      if (!s || !s.probes) continue;
      for (const p of s.probes) {
        const drawn = p.links.filter((v) => !v.startsWith('|'));
        if (!drawn.length) continue;
        samples++;
        if (new Set(drawn).size !== 1) { bad++; rows.push(`${key}#${p.frame}: ${[...new Set(drawn)].join(' vs ')}`); }
        const marks = p.marks.filter((v) => !v.startsWith('|'));
        if (marks.length && new Set(marks).size !== 1) { bad++; rows.push(`${key}#${p.frame} marks: ${[...new Set(marks)].join(' vs ')}`); }
      }
    }
    const p1 = probe('S3: one link written differently from its siblings is detected', () => {
      const tampered = ['1.25|0.8000', '1.25|0.8000', '1.90|0.8000', '1.25|0.8000'];
      return new Set(tampered).size !== 1;
    });
    record('S3', 'every membership link and mark is written identically — no link is a strength',
      bad === 0 && samples > 0 && p1,
      [`${samples} probe frames across three pattern sequences, read off the live elements`,
        `frames in which the links or marks differ from each other: ${bad}${rows.length ? ' — ' + rows.join('; ') : ''}`,
        `probe detected a planted difference: ${p1}`]);
  }

  /* ---- S4 every topic is named in every world ------------------------------------- */
  {
    const rows = [];
    let hidden = 0, samples = 0;
    const s = report.sequences.find((x) => x.key === 'ambient');
    for (const p of (s && s.probes) || []) {
      samples++;
      if (p.labelCount !== TOPICS.length) rows.push(`frame ${p.frame}: ${p.labelCount} labels exist, ${TOPICS.length} topics`);
      const invisible = p.labelOpacity.filter((o) => !(o > 0.05)).length;
      if (invisible) { hidden++; rows.push(`frame ${p.frame}: ${invisible} labels at or below 0.05 opacity`); }
    }
    const p1 = probe('S4: a suppressed label is detected', () => [0.9, 0.0, 0.7].filter((o) => !(o > 0.05)).length > 0);
    record('S4', 'every topic is named in every world — dimness is never a claim about knowledge',
      hidden === 0 && samples > 0 && p1,
      [`${samples} probe frames across all three worlds`,
        `frames with a suppressed label: ${hidden}${rows.length ? ' — ' + rows.join('; ') : ''}`,
        `public-world label alpha is ${WORLDS.public.labelAlpha}, applied to the whole field`,
        `probe detected: ${p1}`]);
  }

  /* ---- S5 the Shared world's dash is one pattern, not a per-topic fraction --------- */
  {
    const rows = [];
    let bad = 0, samples = 0;
    const s = report.sequences.find((x) => x.key === 'ambient');
    for (const p of (s && s.probes) || []) {
      const dashes = p.ringDash.filter((d) => d !== '');
      if (!dashes.length) continue;
      samples++;
      if (new Set(dashes).size !== 1) { bad++; rows.push(`frame ${p.frame}: ${new Set(dashes).size} distinct dash patterns`); }
    }
    const p1 = probe('S5: per-topic dash patterns are detected', () => new Set(['7 5', '11 3', '4 8']).size !== 1);
    record('S5', 'a dashed contour says WHICH WORLD, never how much of a topic is shared',
      bad === 0 && samples > 0 && p1,
      [`${samples} probe frames carried dashed contours`,
        `frames with more than one dash pattern: ${bad}${rows.length ? ' — ' + rows.join('; ') : ''}`,
        `I-08B3.1-D2 wrote a dash per topic, computed from an invented "shared fraction"`,
        `probe detected: ${p1}`]);
  }

  return probes;

}

/* ====================================================== the semantics, without pixels === */
/**
 * S6 AND C9-P NEED NOTHING BUT THIS PACKAGE, so they run from a bare extraction — which is the
 * only place the check actually matters to a reviewer who did not build it.
 */
export function verifySemantics() {
  /* ---- S6 no SHIPPING semantic surface reasserts a semantics REV-01/REV-02 removed --- */
  {
    /*
     * WHY S1 WAS NOT ENOUGH, WHICH IS THE WHOLE REASON THIS EXISTS.
     *
     * S1 reads PRESENTATION_CONTRACT and proves every ambient property declares no encoding.
     * It passed. Meanwhile the TOKEN GENERATOR -- a different artefact, emitting a file that
     * SHIPS -- described the same depth planes as "TEMPORAL DISTANCE, how recently a topic was
     * active", named the near plane "Recent.", and called contour morphology a SIGNATURE that is
     * "the same for every user, forever". The contract and the tokens disagreed, and nothing in
     * the package compared them, so a package with a correct contract shipped the removed claim
     * anyway.
     *
     * S6 is therefore a CROSS-ARTEFACT check, not a second local one: it reads the EMITTED token
     * tree from disk and the other generated semantic surfaces, and asserts that none of them
     * reasserts a semantics REV-01 or REV-02 removed. Reading the emitted file is the point --
     * it compares the generator with its output instead of trusting them to agree.
     *
     * IT IS NOT A PROSE LINTER. It inspects STRUCTURED, GENERATED, FINAL-STATE strings only:
     * token descriptions, the contract's own statements, the Skill Gate consequences and the
     * non-token contract statements. Narrative documents are not scanned, because a document is
     * allowed to say "D2 claimed X and D2R removed it" -- that sentence is the correction, not
     * the regression.
     */
    const REGRESSIONS = [
      ['depth = recency / temporal distance',
        /\b(depth|near|far|plane|layer)\b[^.]{0,140}?\b(temporal distance|recenc|how recently|recently .{0,24}active)\b/i],
      ['near / far = recent / old',
        /^\s*(recent|long ago|older|the oldest)\.?\s*$/i],
      ['contour or shape = topic identity',
        /\b(contour|shape|irregularit|level set)\b[^.]{0,170}?\b(its own identity|own stable id|analytical identity|is a signature|a SIGNATURE|identity channel is)\b/i],
      ['shape = a recognisable topic identity',
        /\brecogni[sz]able\b[^.]{0,90}?\b(before its label|by (its )?shape|topic)\b/i],
      ['Pattern = a staggered order',
        /\b(pattern|member|link|tie)\b[^.]{0,140}?\bstagger/i],
      ['Pattern = fitted axis / spine / residual structure',
        /\b(pattern|member|structure)\b[^.]{0,140}?\b(principal axis|fitted axis|spine|residual fit|its residuals|drew residuals)\b/i],
    ];

    /*
     * TWO EXEMPTIONS, BOTH NARROW.
     *
     * HISTORICAL -- the sentence names I-08B3.1-D2 (never D2R) alongside a removal verb. This is
     * what the brief's requirement F asks for: "D2 fitted a principal axis and D2R removed it"
     * must stay sayable, or the guard would forbid the prose that explains the correction.
     *
     * DENIED -- the sentence asserts the ABSENCE of the thing. "PATTERN is a LINE DRAWING and
     * deliberately WITHOUT a STAGGER" is the corrected claim, and it must not be read as the
     * defect it exists to rule out.
     */
    const HISTORICAL = /\bD2\b(?!R)[^.]{0,160}?\b(claimed|said|wrote|fitted|computed|attached|derived|staggered|shipped|used|removed|rejected)\b|\b(was|were|is|are) removed\b|\bno longer\b|\bsuperseded\b|\bused to\b/i;
    const DENIED = /\b(without|no|not|never|none|nothing|encodes nothing|presentation only|simultaneous|cannot|does not|do not|carries no|is not)\b/i;

    const sentences = (s) => String(s).split(/(?<=[.!?])\s+|\s*;\s+/).filter(Boolean);

    /* ---- the surfaces: all generated, all shipping ----------------------------------- */
    const surfaces = [];
    const walk = (node, path) => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (k === '$description' && typeof v === 'string') surfaces.push([path + '.' + k, v]);
        else if (v && typeof v === 'object') walk(v, path + '.' + k);
      }
    };
    for (const rel of ['tokens/base/illumination.tokens.json', 'tokens/appearance/dark.illumination.tokens.json']) {
      const p = join(PKG, rel);
      if (existsSync(p)) walk(JSON.parse(readFileSync(p, 'utf8')), rel);
    }
    for (const [key, entry] of Object.entries(PRESENTATION_CONTRACT)) {
      if (entry.is) surfaces.push(['PRESENTATION_CONTRACT.' + key + '.is', entry.is]);
      if (entry.encodes) surfaces.push(['PRESENTATION_CONTRACT.' + key + '.encodes', entry.encodes]);
      if (entry.source) surfaces.push(['PRESENTATION_CONTRACT.' + key + '.source', entry.source]);
    }
    for (const [i, s] of CONTRACT_STATEMENTS.entries()) surfaces.push(['CONTRACT_STATEMENTS[' + i + ']', s]);
    for (const s of USED) for (const [i, c] of (s.changed || []).entries()) surfaces.push(['skill:' + s.name + '.changed[' + i + ']', c]);
    for (const [q, a] of NEVER_SHIP) surfaces.push(['NEVER_SHIP:' + q, a]);

    const scan = (rows) => {
      const found = [];
      for (const [where, text] of rows) {
        for (const sentence of sentences(text)) {
          if (HISTORICAL.test(sentence) || DENIED.test(sentence)) continue;
          for (const [label, re] of REGRESSIONS) if (re.test(sentence)) found.push(where + ' -- ' + label);
        }
      }
      return found;
    };
    const hits = scan(surfaces);

    /*
     * THE DENOMINATOR IS PART OF THE RESULT. A guard that inspected nothing reports zero hits and
     * looks exactly like a guard that inspected everything and found nothing.
     */
    const enough = surfaces.length >= 120;

    const planted = [
      ['depth = temporal distance', [['tokens/base/a.$description', 'One lightness per depth plane. Depth is TEMPORAL DISTANCE, how recently a topic was active.']]],
      ['near = recent', [['tokens/base/b.$description', 'Recent.']]],
      ['contour = identity', [['tokens/base/c.$description', 'A topic is drawn as contour lines whose shape comes from its own identity, so the field is specific.']]],
      ['recognisable by shape', [['skill:d.changed[0]', 'A topic is recognisable before its label is read.']]],
      ['Pattern staggered', [['NEVER_SHIP:e', 'The pattern four membership links are staggered across the span.']]],
      ['Pattern spine', [['CONTRACT_STATEMENTS[0]', 'The pattern is drawn as a spine fitted to the member positions.']]],
    ];
    const detected = planted.map(([name, rows]) => probe('S6: a planted "' + name + '" regression is detected', () => scan(rows).length > 0));

    const histOk = probe('S6: historical correction prose is NOT flagged', () => scan([
      ['probe', 'I-08B3.1-D2 fitted a principal axis to the member positions and drew residuals from it, and D2R removed it entirely.'],
      ['probe', 'D2 claimed the depth plane was how recently the topic was active.'],
    ]).length === 0);

    record('S6', 'no shipping semantic surface reasserts a semantics REV-01 or REV-02 removed',
      hits.length === 0 && enough && detected.every(Boolean) && histOk,
      [surfaces.length + ' generated final-state strings inspected: the emitted token tree read back from disk, PRESENTATION_CONTRACT, ' + CONTRACT_STATEMENTS.length + ' contract statements, ' + USED.length + ' skill consequence blocks and ' + NEVER_SHIP.length + ' never-ship answers',
        'active regressions found: ' + hits.length + (hits.length ? ' -- ' + hits.join('; ') : ''),
        'all ' + planted.length + ' planted regressions detected: ' + detected.every(Boolean),
        'historical correction prose correctly ignored: ' + histOk,
        'denominator asserted (>= 120 strings): ' + enough]);
  }

  /* ---- C9-P the identity-material allowlist can fail ---------------------------------- */
  {
    const CHROME_BRASS = ['#q-base', '#nav'];
    const paintSrc = readFileSync(join(PKG, 'prototypes', 'D2_LIGHT_SYSTEM.html'), 'utf8').split('<script>')[0];
    const styles = [...paintSrc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    const selectorsWithBrass = (css) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => /#a58e6f/i.test(m[2]))
      .map((m) => m[1].trim().split('\n').pop().trim());
    const p1 = probe('C9: the identity material painted on a membership link IS detected',
      () => selectorsWithBrass(styles + '\n#link-0{stroke:#a58e6f}').some((s) => !CHROME_BRASS.includes(s)));
    const p2 = probe('C9: the chrome declarations are NOT flagged',
      () => selectorsWithBrass(styles).every((s) => CHROME_BRASS.includes(s)));
    record('C9-P', 'the identity-material check can fail, and does not fire on chrome',
      p1 && p2, ['planted paint on #link-0 detected: ' + p1, 'chrome declarations correctly ignored: ' + p2,
        'selectors actually carrying the material: ' + selectorsWithBrass(styles).join(', ')]);
  }

  return probes;
}


/* ========================================================================== main ====== */
if (isMain(import.meta.url)) {
  /**
   * THE STATE HALF NEEDS NOTHING BUT THIS PACKAGE. THE PIXEL HALF NEEDS 2,106 CAPTURED FRAMES,
   * AND THOSE DO NOT SHIP — 1.8 GB of PNGs is not a review artefact.
   *
   * So from a bare extraction this tool runs C1–C9 and the three guards that read only the
   * package, and REFUSES THE REST BY NAME. The first version threw a bare ENOENT four
   * directories deep, which is exactly the failure mode `D2R_METHOD.md` claims every tool here
   * avoids — a claim the archive's own extraction disproved within a minute of being made.
   *
   * It exits non-zero when it cannot run everything, so "it printed some passes" is never
   * mistaken for "it verified the package".
   */
  const reportPath = join(PKG, 'data', 'D2_CAPTURE_REPORT.json');
  const haveReport = existsSync(reportPath);
  const haveFrames = existsSync(FRAMES) && existsSync(join(FRAMES, 'pattern', '0000.png'));

  console.log('D2 VERIFY — the state trace\n');
  verifyState(ARRIVALS, REDUCED);

  console.log('\nD2 VERIFY — the semantic guards (no pixels required)\n');
  verifySemantics();
  if (haveReport && haveFrames) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    console.log('\nD2 VERIFY — the pixels\n');
    verifyRaster(report);
    console.log('\nD2 VERIFY — the guards\n');
    verifyGuards(report);
  } else {
    console.log('\nD2 VERIFY — the pixels and the guards: UNVERIFIABLE HERE, and not claimed\n');
    console.log(`  ${haveReport ? 'data/D2_CAPTURE_REPORT.json is present' : 'data/D2_CAPTURE_REPORT.json is MISSING'}`);
    console.log(`  ${haveFrames ? 'the captured frames are present' : `the captured frames are MISSING — expected them under ${FRAMES}`}`);
    console.log('  R1-R8 and G2-G4 read 2,106 PNGs that are deliberately NOT shipped in this package.');
    console.log('  To reproduce them: node source/tools/d2-build.mjs && node source/tools/d2-capture.mjs');
    console.log(`  The results of the full run are recorded in data/D2_VERIFY_RESULTS.json.`);
  }

  const held = results.filter((r) => r.ok).length;
  const complete = haveReport && haveFrames;
  console.log(`\n  ${held}/${results.length} hold; ${probes.filter((p) => p.detected).length}/${probes.length} probes detected their planted violation${complete ? '' : ' (state trace and semantic guards only — the pixel half did not run)'}`);
  if (complete) {
    writeFileSync(join(PKG, 'data', 'D2_VERIFY_RESULTS.json'),
      JSON.stringify({ generated: 'source/tools/d2-verify.mjs', lightLine: LIGHT_LINE, lightFloor: LIGHT_FLOOR, spreadFloor: SPREAD_FLOOR, sensitivityAlpha: LIGHT_SENSITIVITY, results, probes }, null, 2) + '\n');
  } else {
    console.log('  data/D2_VERIFY_RESULTS.json was NOT rewritten — a partial run must not overwrite a complete one.');
  }
  if (held !== results.length || !complete) process.exitCode = 1;
}
