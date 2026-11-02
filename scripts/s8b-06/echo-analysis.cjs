'use strict';
/**
 * S8B-06 CP1 — echo leakage versus external sound, measured against QANDEEL's KNOWN reference. VALIDATION TOOLING ONLY.
 *
 * A quiet room cannot be assumed (street, motorcycles, passers-by). Loudness alone proves nothing about where a sound came
 * from, so the reply the fake gateway sends is GATED by a seeded pseudo-random pattern: QANDEEL sounds for 300–800 ms, then
 * is silent for 300–800 ms, and so on (`prbs`), or never sounds at all (`silent`, the external-noise-only control). The
 * gating is known exactly, chunk by chunk. Then, on the post-canceller uplink (the levels the gateway decoded):
 *
 *   - echo can only follow the pattern: the uplink level is correlated with the pattern at the acoustic lag, the lag is
 *     searched, and the correlation is tested against a permutation null (the same search over randomly rotated patterns),
 *     so a coincidence of street noise and pattern is not mistaken for echo;
 *   - leakage is the uplink power added while QANDEEL sounds over the power of the ADJACENT silent segments, using only
 *     pairs whose silent neighbours show no external event; segments a passing sound contaminated are excluded from the
 *     AEC estimate only, and counted as external events;
 *   - each barge-in candidate is classified by evidence: energy present while QANDEEL was silent (EXTERNAL), energy only
 *     while QANDEEL sounded with clean silent neighbours (ECHO_ATTRIBUTABLE — conservative: an external sound that fits
 *     inside a sounding segment is counted against the canceller), otherwise UNDETERMINED.
 *
 * Numbers only: the uplink levels, never samples. Nothing here is an acceptance threshold; the analyzability rule (enough
 * clean pairs) only decides whether a run can say anything about the canceller.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The gating of a reply: true = QANDEEL sounds in that 20 ms chunk. null = not gated (continuous). */
function gatePattern(chunks, mode, seed) {
  if (mode === 'silent') return new Array(chunks).fill(false);
  if (mode !== 'prbs' && mode !== 'duck') return null; // 'duck': the same pattern, OFF = the voice 40 dB quieter
  const rnd = mulberry32(seed);
  const mask = [];
  let on = false; // a leading silent segment: a reference before the first sound
  while (mask.length < chunks) {
    const len = 15 + Math.floor(rnd() * 26); // 300 … 800 ms
    for (let i = 0; i < len && mask.length < chunks; i += 1) mask.push(on);
    on = !on;
  }
  return mask;
}

const median = (v) => {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const lin = (db) => 10 ** (db / 10);

function pearson(x, y) {
  const n = x.length;
  if (n < 3) return 0;
  let sx = 0; let sy = 0;
  for (let i = 0; i < n; i += 1) { sx += x[i]; sy += y[i]; }
  const mx = sx / n; const my = sy / n;
  let cxy = 0; let cxx = 0; let cyy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = x[i] - mx; const b = y[i] - my;
    cxy += a * b; cxx += a * a; cyy += b * b;
  }
  return cxx === 0 || cyy === 0 ? 0 : cxy / Math.sqrt(cxx * cyy);
}

function signTestP(k, n) {
  // one-sided P(X >= k), X ~ Binomial(n, 1/2)
  if (n === 0) return null;
  let p = 0;
  let c = 1;
  for (let i = 0; i <= n; i += 1) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i >= k) p += c;
  }
  return p / 2 ** n;
}

const TAIL_FRAMES = 5; // 100 ms of room reverberation after QANDEEL stops: neither sounding nor silent
const LEAD_FRAMES = 1; // 20 ms of lag uncertainty after it starts

/** Frame states at a lag: captureMs → { c, on, core } for the chunks analysed. `start` is a number or a per-chunk timeline. */
function statesAt(mask, n, start, lag) {
  const map = new Map();
  for (let c = 0; c < n; c += 1) {
    const base = typeof start === 'number' ? start + 20 * c : start[c];
    const f = Math.round((base + lag) / 20) * 20;
    let core = true;
    if (mask[c]) {
      for (let k = 0; k < LEAD_FRAMES; k += 1) if (c - k > 0 && !mask[c - k - 1]) core = false;
    } else {
      for (let k = 1; k <= TAIL_FRAMES; k += 1) if (c - k >= 0 && mask[c - k]) core = false;
    }
    map.set(f, { c, on: mask[c], core });
  }
  return map;
}

function correlationAt(mask, n, start, lag, level) {
  const x = []; const y = [];
  for (const [f, s] of statesAt(mask, n, start, lag)) {
    if (!s.core) continue;
    const l = level.get(f);
    if (l === undefined) continue;
    x.push(s.on ? 1 : 0);
    y.push(l);
  }
  return pearson(x, y);
}

/**
 * @param uplink [{captureMs, levelDb, receivedAt}]   the call's received uplink (post-canceller)
 * @param mask   boolean[] per chunk, refDb number[] per chunk, sendAt number[] (wall ms each chunk first left)
 * @param chunks how many chunks were heard (a cut reply: up to its final mark)
 * @param candidates captureMs of barge-in onsets (candidates and cuts)
 */
function analyzeEcho({ uplink, mask, refDb, sendAt, marks = [], chunks, candidates = [], lagMaxMs = 1500, permutations = 200, seed = 7, fixedLagMs = null }) {
  if (!mask) return { error: 'NOT_GATED' };
  if (uplink.length < 50 || sendAt[0] === undefined) return { error: 'NOT_ENOUGH_DATA' };
  const level = new Map(uplink.map((p) => [p.captureMs, p.levelDb]));
  // Ranks (Spearman): a loud passing sound weighs no more than any other loud frame.
  const sorted = [...uplink].sort((a, b) => a.levelDb - b.levelDb);
  const rank = new Map(sorted.map((p, i) => [p.captureMs, i]));
  const origin = Math.min(...uplink.map((p) => p.receivedAt - p.captureMs));
  const n = Math.min(chunks, mask.length);
  // The timeline of each chunk in capture time. With the phone's own heard marks (PLAYOUT: chunk k fully presented by the
  // instant its mark arrived) the timeline follows what was really played, slips included; the lag then only absorbs the
  // mark's report delay and the capture path (searched in −300 … +300 ms). Without marks: the send instants + a 0 … 1.5 s lag.
  let start = sendAt[0] - origin;
  let lagMin = 0;
  let lagMax = lagMaxMs;
  let timeline = 'SEND';
  const usable = marks.filter((m, i) => i === 0 || m[1] > marks[i - 1][1]);
  if (usable.length >= 5) {
    const t = new Array(n);
    let j = 0;
    for (let c = 0; c < n; c += 1) {
      while (j < usable.length - 1 && usable[j][1] < c) j += 1;
      const [at, k] = usable[j];
      t[c] = at - origin - (k - c + 1) * 20;
    }
    start = t;
    lagMin = -300;
    lagMax = 300;
    timeline = 'HEARD_MARKS';
  }
  // A lag fixed in advance (from a condition where the echo is strong) removes the search's selection bias: the condition
  // under test is then evaluated at one lag, not at the lag that happens to favour it.
  if (fixedLagMs !== null) {
    lagMin = fixedLagMs;
    lagMax = fixedLagMs;
  }
  const anyOn = mask.slice(0, n).some(Boolean);
  const out = { pattern: anyOn ? 'prbs' : 'silent', timeline, lagFixed: fixedLagMs !== null, marks: usable.length, chunksAnalyzed: n, captureOriginMs: origin, startCaptureMs: round(typeof start === 'number' ? start : start[0], 0) };

  let lag = null;
  if (anyOn) {
    let best = -2;
    for (let l = lagMin; l <= lagMax; l += 20) {
      const r = correlationAt(mask, n, start, l, rank);
      if (r > best) { best = r; lag = l; }
    }
    const rnd = mulberry32(seed);
    let atLeast = 0;
    const nulls = [];
    for (let k = 0; k < permutations; k += 1) {
      const s = 50 + Math.floor(rnd() * Math.max(1, n - 100));
      const rotated = mask.slice(0, n).map((_, i) => mask[(i + s) % n]);
      let m = -2;
      for (let l = lagMin; l <= lagMax; l += 20) m = Math.max(m, correlationAt(rotated, n, start, l, rank));
      nulls.push(m);
      if (m >= best) atLeast += 1;
    }
    nulls.sort((a, b) => a - b);
    Object.assign(out, { bestLagMs: lag, correlation: round(best, 3), nullP95: round(nulls[Math.floor(0.95 * nulls.length)], 3), pNull: round((1 + atLeast) / (1 + permutations), 4) });
  }

  // Segments at the found lag (or, for `silent`, the whole reply as one silent span).
  const states = statesAt(mask, n, start, lag ?? 0);
  const segs = [];
  for (let c = 0; c < n; c += 1) {
    if (c === 0 || mask[c] !== mask[c - 1]) segs.push({ on: mask[c], c0: c, c1: c, frames: [] });
    segs.at(-1).c1 = c;
  }
  for (const [f, s] of states) {
    if (!s.core) continue;
    const l = level.get(f);
    if (l === undefined) continue;
    const seg = segs.find((g) => s.c >= g.c0 && s.c <= g.c1);
    seg.frames.push([f, l]);
  }
  for (const g of segs) g.med = median(g.frames.map((x) => x[1]));
  const offs = segs.filter((g) => !g.on && g.frames.length > 0);
  const baseline = anyOn ? median(offs.map((g) => g.med)) : median(offs.flatMap((g) => g.frames.map((x) => x[1])));
  const threshold = baseline === null ? null : baseline + 12;
  const external = [];
  if (anyOn) {
    for (const g of offs) {
      const peak = Math.max(...g.frames.map((x) => x[1]));
      g.clean = peak <= threshold;
      if (!g.clean) external.push({ fromMs: g.frames[0][0], toMs: g.frames.at(-1)[0], peakDb: round(peak) });
    }
  } else {
    // silent control: runs of frames above the floor + 12 dB are external events
    let run = null;
    for (const [f, l] of offs.flatMap((g) => g.frames)) {
      if (l > threshold) {
        if (run && f - run.toMs <= 60) { run.toMs = f; run.peakDb = Math.max(run.peakDb, l); } else { run = { fromMs: f, toMs: f, peakDb: l }; external.push(run); }
      }
    }
    external.forEach((e) => { e.peakDb = round(e.peakDb); });
  }
  out.offBaselineDb = round(baseline);
  out.externalEvents = { count: external.length, totalMs: external.reduce((s, e) => s + e.toMs - e.fromMs + 20, 0), events: external.slice(0, 40) };

  if (anyOn) {
    const pairs = [];
    let onLin = []; let offLin = [];
    segs.forEach((g, i) => {
      if (!g.on || g.frames.length < 5) return;
      const nb = [segs[i - 1], segs[i + 1]].filter((x) => x && !x.on && x.frames.length > 0);
      if (nb.length === 0) return;
      const valid = nb.every((x) => x.clean);
      const offMed = median(nb.map((x) => x.med));
      pairs.push({ valid, d: g.med - offMed, added: lin(g.med) - lin(offMed) });
      if (valid) {
        onLin = onLin.concat(g.frames.map((x) => lin(x[1])));
        for (const x of nb) offLin = offLin.concat(x.frames.map((y) => lin(y[1])));
      }
    });
    const valid = pairs.filter((p) => p.valid);
    const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    // Per-pair medians: an event shorter than half a segment cannot move the leak estimate.
    const added = valid.length ? median(valid.map((p) => p.added)) : null;
    const refOn = median(refDb.slice(0, n).filter((_, c) => mask[c]));
    const leakDb = added === null ? null : added > 0 ? 10 * Math.log10(added) : -120;
    const positive = valid.filter((p) => p.d > 0).length;
    Object.assign(out, {
      onSegments: pairs.length, validPairs: valid.length,
      analyzable: valid.length >= 12 && valid.length >= 0.6 * pairs.length,
      onMeanDb: valid.length ? round(10 * Math.log10(mean(onLin))) : null, offMeanDb: valid.length ? round(10 * Math.log10(mean(offLin))) : null,
      pairDiffDb: { median: round(median(valid.map((p) => p.d))), positive, n: valid.length, pSign: round(signTestP(positive, valid.length), 4) },
      refOnDb: round(refOn), leakDb: round(leakDb), refMinusLeakDb: leakDb === null ? null : round(refOn - leakDb),
      // Each valid pair (ON − OFF in dB, and the power it adds), so repetitions of one condition can be pooled.
      validPairDiffs: valid.map((p) => [round(p.d), p.added]),
    });
  }

  // Barge-in candidates, by evidence.
  out.candidates = candidates.map((o) => {
    const frames = [];
    for (let f = o; f < o + 200; f += 20) frames.push({ f, s: states.get(f), l: level.get(f) });
    const peak = Math.max(...frames.map((x) => x.l ?? -120));
    if (!anyOn) return { captureMs: o, class: 'NO_QANDEEL_SOUND', peakDb: round(peak) };
    let energyWhileSilent = false;
    for (let f = o; f < o + 400; f += 20) {
      const s = states.get(f);
      const l = level.get(f);
      if (s && !s.on && s.core && l !== undefined && l > threshold) energyWhileSilent = true;
    }
    if (energyWhileSilent) return { captureMs: o, class: 'EXTERNAL', peakDb: round(peak), evidence: 'energy above the silent baseline + 12 dB while QANDEEL was silent' };
    const allOn = frames.every((x) => x.s && x.s.on && x.s.core);
    if (allOn) {
      const seg = segs.find((g) => g.on && frames[0].s.c >= g.c0 && frames[0].s.c <= g.c1);
      const i = segs.indexOf(seg);
      const nb = [segs[i - 1], segs[i + 1]].filter((x) => x && !x.on && x.frames.length > 0);
      if (nb.every((x) => x.clean)) return { captureMs: o, class: 'ECHO_ATTRIBUTABLE', peakDb: round(peak), evidence: 'energy only while QANDEEL sounded, silent neighbours clean' };
    }
    return { captureMs: o, class: 'UNDETERMINED', peakDb: round(peak) };
  });
  return out;
}

module.exports = { gatePattern, analyzeEcho, mulberry32, signTestP };
