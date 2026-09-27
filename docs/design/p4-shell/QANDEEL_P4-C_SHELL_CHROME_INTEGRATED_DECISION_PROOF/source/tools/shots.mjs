// P4-C — THE CAPTURE PLAN: every Product capture the boards use, declared once, with its exact state. The capture tool
// renders exactly this list; the boards read captures only by these ids; the checks verify the list against SHOTS.json.
// No exhaustive Cartesian product: per decision the same content, device and language, varying one decision at a time.
const shot = (id, o) => ({ id, state: 'conv', lang: 'ar', appearance: 'dark', w: 390, h: 844, contrast: false, q: {}, ...o });
const A320 = { w: 320, h: 568 }, W430 = { w: 430, h: 932 };
export const SHOTS = [];
const add = (...s) => SHOTS.push(...s);

// ---------------------------------------------------------------- 01 authority baseline (the incumbent, untouched)
add(shot('b-conv-ad', { q: { s: 'none', u: 'none', q: 'A', sw: 'plate' } }),
  shot('b-shared-ad', { state: 'shared', q: { s: 'none', u: 'none', q: 'A', sw: 'plate' } }),
  shot('b-analysis-ad', { state: 'analysis', q: { sw: 'g32', x: 'none' } }),
  shot('b-analysis-el', { state: 'analysis-pinned', lang: 'en', appearance: 'light', q: { sw: 'g32', x: 'none' } }));

// ---------------------------------------------------------------- 02 DQ-01 Settings (U-A and Q-A held constant)
for (const s of ['A', 'B']) {
  const q = { s, u: 'A', q: 'A', sw: 'plate' };
  add(shot(`s-${s}-conv-ad`, { q }), shot(`s-${s}-shared-ad`, { state: 'shared', q }), shot(`s-${s}-conv-el`, { lang: 'en', appearance: 'light', q }),
    shot(`s-${s}-conv-a320`, { ...A320, q }), shot(`s-${s}-conv-e320`, { lang: 'en', appearance: 'light', ...A320, q }), shot(`s-${s}-shared-e320`, { state: 'shared', lang: 'en', appearance: 'light', ...A320, q }));
}
add(shot('s-activity-ad', { state: 'activity', q: { s: 'A', u: 'A' } }), shot('s-settings-ad', { state: 'settings', q: { s: 'A', u: 'A' } }),
  shot('s-settings-notif-el', { state: 'settings', lang: 'en', appearance: 'light', q: { s: 'A', u: 'A', section: 'notif' } }));

// ---------------------------------------------------------------- 03 DQ-02 Understanding (S-B and Q-A held constant)
for (const u of ['A', 'B']) {
  const q = { s: 'B', u, q: 'A', sw: 'plate' };
  add(shot(`u-${u}-ad`, { q }), shot(`u-${u}-press-ad`, { q: { ...q, press: '#u-entry' } }), shot(`u-${u}-focus-ad`, { q, focus: '#u-entry' }),
    shot(`u-${u}-el`, { lang: 'en', appearance: 'light', q }), shot(`u-${u}-a320`, { ...A320, q }), shot(`u-${u}-e320`, { lang: 'en', ...A320, q }));
}
add(shot('u-B-sA-a320', { ...A320, q: { s: 'A', u: 'B', q: 'A', sw: 'plate' } }),
  shot('u-S-rejected-ad', { state: 'settings', q: { s: 'B', u: 'A', defect: 'understandinginsettings' }, rejected: true }),
  shot('u-page-ad', { state: 'understanding', q: { s: 'B', u: 'A' } }));

// ---------------------------------------------------------------- 04 DQ-03 Q (S-B, U-A held constant)
for (const qq of ['A', 'B', 'C']) {
  const q = { s: 'B', u: 'A', q: qq, sw: 'plate', scroll: 'top' };
  add(shot(`q-${qq}-conv-ad`, { q }), shot(`q-${qq}-shared-ad`, { state: 'shared', q }), shot(`q-${qq}-conv-el`, { lang: 'en', appearance: 'light', q }),
    shot(`q-${qq}-conv-a320`, { ...A320, q }));
}
add(shot('q-B-sA-conv-ad', { q: { s: 'A', u: 'A', q: 'B', sw: 'plate', scroll: 'top' } }), shot('q-B-sA-conv-a320', { ...A320, q: { s: 'A', u: 'A', q: 'B', sw: 'plate' } }),
  shot('q-moment-cue-ad', { state: 'analysis-cue', q: { sw: 'plate', x: 'none' } }));

// ---------------------------------------------------------------- 05 DQ-04A the Global Switcher (every other candidate constant)
for (const sw of ['plate', 'ground', 'seam']) {
  const q = { s: 'B', u: 'A', q: 'A', sw, x: 'none' };
  add(shot(`w-${sw}-conv-ad`, { q }), shot(`w-${sw}-conv-el`, { lang: 'en', appearance: 'light', q }), shot(`w-${sw}-shared-ad`, { state: 'shared', q }),
    shot(`w-${sw}-analysis-ad`, { state: 'analysis', q }), shot(`w-${sw}-conv-a320`, { ...A320, q }),
    shot(`w-${sw}-press-ad`, { q: { ...q, press: '#phone .rail .it[data-nav="shared"]' } }), shot(`w-${sw}-focus-el`, { lang: 'en', appearance: 'light', q, focus: '#phone .rail .it[data-nav="shared"]' }),
    shot(`w-${sw}-hc-ad`, { contrast: true, q }));
}

// ---------------------------------------------------------------- 06 DQ-04B «سياق الكلام» (switcher SW-1 constant)
for (const x of ['end', 'centre', 'top']) {
  const q = { sw: 'plate', x };
  add(shot(`x-${x}-p1-ad`, { state: 'analysis', q }), shot(`x-${x}-pinned-el`, { state: 'analysis-pinned', lang: 'en', appearance: 'light', q }),
    shot(`x-${x}-call-ad`, { state: 'analysis-call', q }), shot(`x-${x}-cp320-ad`, { state: 'analysis-callpinned', ...A320, q }),
    shot(`x-${x}-cp320-el`, { state: 'analysis-callpinned', lang: 'en', ...A320, q }));
}

// ---------------------------------------------------------------- 07–10 integrated directions (at most two)
for (const d of ['I', 'II']) {
  const q = { dir: d };
  add(shot(`i${d}-conv-ad`, { q }), shot(`i${d}-shared-ad`, { state: 'shared', q }), shot(`i${d}-analysis-ad`, { state: 'analysis', q }), shot(`i${d}-call-ad`, { state: 'analysis-call', q }),
    shot(`i${d}-conv-el`, { lang: 'en', appearance: 'light', q }), shot(`i${d}-shared-el`, { state: 'shared', lang: 'en', appearance: 'light', q }),
    shot(`i${d}-pinned-el`, { state: 'analysis-pinned', lang: 'en', appearance: 'light', q }), shot(`i${d}-settings-el`, { state: 'settings', lang: 'en', appearance: 'light', q }),
    shot(`i${d}-conv-a320`, { ...A320, q }), shot(`i${d}-conv-e320`, { lang: 'en', appearance: 'light', ...A320, q }), shot(`i${d}-cp320-ad`, { state: 'analysis-callpinned', ...A320, q }),
    shot(`i${d}-large-ad`, { q: { ...q, ts: 'large' } }), shot(`i${d}-conv-a430`, { ...W430, q }),
    shot(`i${d}-hc-ad`, { contrast: true, q }), shot(`i${d}-hc-el`, { lang: 'en', appearance: 'light', contrast: true, q }),
    shot(`i${d}-focus1-ad`, { q, focus: '#act-entry' }), shot(`i${d}-focus2-ad`, { q, focus: d === 'I' ? '#u-entry' : '#set-entry' }), shot(`i${d}-focus3-ad`, { q, focus: d === 'I' ? '#set-entry' : '#u-entry' }));
}

/** The captures kept in the package (captures/): one representative per decision and per integrated direction. */
export const KEEP = ['b-conv-ad', 'b-analysis-ad', 's-A-conv-ad', 's-B-conv-ad', 's-A-conv-a320', 's-B-shared-ad', 'u-A-ad', 'u-B-ad', 'u-B-sA-a320',
  'q-A-conv-ad', 'q-B-conv-ad', 'q-C-shared-ad', 'q-moment-cue-ad', 'w-plate-conv-ad', 'w-ground-conv-ad', 'w-seam-conv-ad', 'w-seam-analysis-ad',
  'x-end-call-ad', 'x-centre-call-ad', 'x-top-cp320-ad', 'iI-conv-ad', 'iII-conv-ad', 'iI-conv-el', 'iII-conv-el', 'iI-cp320-ad', 'iII-conv-a320', 'iI-hc-ad', 'iII-focus2-ad'];
