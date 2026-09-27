// P4-C3 — THE CAPTURE PLAN: every Product capture the boards use, declared once, with its exact state. The capture tool
// renders exactly this list; the boards read captures only by these ids; the checks verify the list against SHOTS.json.
const shot = (id, o) => ({ id, state: 'conv', lang: 'ar', appearance: 'dark', w: 390, h: 844, contrast: false, rm: false, q: {}, ...o });
const A320 = { w: 320, h: 568 }, W430 = { w: 430, h: 932 };
export const SHOTS = [];
const add = (...s) => SHOTS.push(...s);

// ---------------------------------------------------------------- A · system launch → app-owned boundary
for (const ap of ['dark', 'light']) {
  const a = ap[0];
  add(shot(`l-ios-${a}`, { state: 'launch-ios', appearance: ap }), shot(`h-ios-${a}`, { state: 'handoff-ios', appearance: ap }),
    shot(`l-and-${a}`, { state: 'launch-android', appearance: ap }), shot(`h-and-${a}`, { state: 'handoff-android', appearance: ap }));
}
add(shot('l-and-d430', { state: 'launch-android', ...W430 }), shot('l-ios-d320', { state: 'launch-ios', ...A320 }));

// ---------------------------------------------------------------- B · Voice Note history + finished call record
add(shot('vn-ar-rest', {}), shot('vn-ar-paused', { q: { vn: 'paused' } }), shot('vn-ar-playing', { q: { vn: 'playing' } }),
  shot('vn-ar-light', { appearance: 'light', q: { vn: 'paused' } }), shot('vn-ar-430', { ...W430, q: { vn: 'paused' } }),
  shot('vn-en-rest', { lang: 'en', appearance: 'light' }), shot('vn-en-paused', { lang: 'en', appearance: 'light', q: { vn: 'paused' } }),
  shot('vn-en-dark', { lang: 'en', q: { vn: 'playing' } }), shot('vn-en-430', { lang: 'en', ...W430, q: { vn: 'paused' } }),
  shot('sent-ar', { state: 'sent' }), shot('sent-en', { state: 'sent', lang: 'en', appearance: 'light' }),
  shot('ended-ar', { state: 'call-ended' }), shot('ended-en', { state: 'call-ended', lang: 'en', appearance: 'light' }));
// ---------------------------------------------------------------- B · recording (non-signal)
add(shot('rec-ar', { state: 'record' }), shot('rec-en', { state: 'record', lang: 'en', appearance: 'light' }),
  shot('rec-ar-light', { state: 'record', appearance: 'light' }), shot('rec-en-dark', { state: 'record', lang: 'en' }),
  shot('rec-ar-320', { state: 'record', ...A320 }), shot('rec-en-320', { state: 'record', lang: 'en', ...A320 }));
// ---------------------------------------------------------------- B · Live Call (non-signal composition)
add(shot('ca-ar', { state: 'call-analysis' }), shot('ca-en', { state: 'call-analysis', lang: 'en', appearance: 'light' }),
  shot('cc-ar', { state: 'call-conv' }), shot('cc-en', { state: 'call-conv', lang: 'en', appearance: 'light' }),
  shot('ca2-ar', { state: 'call-analysis-2' }), shot('cm-ar', { state: 'call-muted' }), shot('cm-en', { state: 'call-muted', lang: 'en' }),
  shot('ca-ar-320', { state: 'call-analysis', ...A320 }), shot('cc-en-320', { state: 'call-conv', lang: 'en', ...A320 }), shot('ca-en-430', { state: 'call-analysis', lang: 'en', ...W430 }));
// the same call, by REAL input: Conversation → call → «المحادثة» → «تحليل المحادثة» (clock advanced between steps)
add(shot('j-ar-0', { state: 'conv', journey: [] }),
  shot('j-ar-1', { state: 'conv', journey: [['click', '#call-entry'], ['advance', 16]] }),
  shot('j-ar-2', { state: 'conv', journey: [['click', '#call-entry'], ['advance', 16], ['frameClick', '#back'], ['advance', 86]] }),
  shot('j-ar-3', { state: 'conv', journey: [['click', '#call-entry'], ['advance', 16], ['frameClick', '#back'], ['advance', 86], ['click', '#door'], ['advance', 16]] }),
  shot('j-ar-4', { state: 'conv', journey: [['click', '#call-entry'], ['advance', 16], ['frameClick', '#back'], ['advance', 86], ['click', '#door'], ['advance', 16], ['click', '#c-end']] }));

// ---------------------------------------------------------------- C · copy in context
add(shot('op-ar', { state: 'opener' }), shot('op-en', { state: 'opener', lang: 'en', appearance: 'light' }),
  shot('op-ar-light', { state: 'opener', appearance: 'light' }), shot('op-en-dark', { state: 'opener', lang: 'en' }),
  shot('an-ar', { state: 'analysis' }), shot('an-en', { state: 'analysis', lang: 'en' }),
  shot('pin-ar', { state: 'analysis-pinned' }), shot('pin-en', { state: 'analysis-pinned', lang: 'en' }),
  shot('rep-ar', { state: 'analysis-replay' }), shot('rep-en', { state: 'analysis-replay', lang: 'en' }),
  shot('set-ar', { state: 'settings' }), shot('set-en', { state: 'settings', lang: 'en', appearance: 'light' }),
  shot('nt-ar-pro', { state: 'notif', q: { sec: 'proactive' } }), shot('nt-en-pro', { state: 'notif', lang: 'en', appearance: 'light', q: { sec: 'proactive' } }),
  shot('nt-ar-quiet', { state: 'notif', q: { sec: 'quiet' } }), shot('nt-en-quiet', { state: 'notif', lang: 'en', appearance: 'light', q: { sec: 'quiet' } }),
  shot('nt-ar-lock', { state: 'notif', q: { sec: 'lock' } }), shot('nt-en-lock', { state: 'notif', lang: 'en', appearance: 'light', q: { sec: 'lock' } }),
  shot('und-ar', { state: 'understanding' }), shot('und-en', { state: 'understanding', lang: 'en', appearance: 'light' }),
  shot('pid-ar', { state: 'publicid' }), shot('pid-en', { state: 'publicid', lang: 'en', appearance: 'light' }));

// ---------------------------------------------------------------- stress · 320 × 568 · large text
add(shot('s320-vn-ar', { ...A320, q: { vn: 'paused', show: '.vn' } }), shot('s320-vn-en', { lang: 'en', ...A320, q: { vn: 'paused', show: '.vn' } }),
  shot('s320-op-ar', { state: 'opener', ...A320 }), shot('s320-op-en', { state: 'opener', lang: 'en', ...A320 }),
  shot('s320-nt-ar', { state: 'notif', ...A320, q: { sec: 'proactive' } }), shot('s320-nt-en', { state: 'notif', lang: 'en', ...A320, q: { sec: 'proactive' } }),
  shot('s320-pid-ar', { state: 'publicid', ...A320 }), shot('s320-pid-en', { state: 'publicid', lang: 'en', ...A320 }),
  shot('s320-set-ar', { state: 'settings', ...A320 }), shot('s320-und-ar', { state: 'understanding', ...A320 }),
  shot('lg-vn-ar', { q: { vn: 'paused', ts: 'large', show: '.vn' } }), shot('lg-vn-en', { lang: 'en', q: { vn: 'paused', ts: 'large', show: '.vn' } }),
  shot('lg-nt-ar', { state: 'notif', q: { sec: 'proactive', ts: 'large' } }), shot('lg-pid-ar', { state: 'publicid', q: { ts: 'large' } }),
  shot('lg-und-ar', { state: 'understanding', q: { ts: 'large' } }), shot('lg-rec-ar', { state: 'record', q: { ts: 'large' } }),
  shot('lg320-vn-ar', { ...A320, q: { vn: 'paused', ts: 'large', show: '.vn' } }), shot('lg320-cc-ar', { state: 'call-conv', ...A320, q: { ts: 'large' } }));

// ---------------------------------------------------------------- accessibility · contrast · reduced motion · focus
add(shot('hc-vn-ar', { contrast: true, q: { vn: 'paused' } }), shot('hc-vn-en', { lang: 'en', appearance: 'light', contrast: true, q: { vn: 'paused' } }),
  shot('hc-ca-ar', { state: 'call-analysis', contrast: true }), shot('hc-nt-en', { state: 'notif', lang: 'en', appearance: 'light', contrast: true, q: { sec: 'proactive' } }),
  shot('rm-vn-ar', { rm: true, q: { vn: 'paused' } }), shot('rm-ca-ar', { state: 'call-analysis', rm: true }), shot('rm-rec-en', { state: 'record', lang: 'en', appearance: 'light', rm: true }),
  shot('f-vplay-ar', { q: { vn: 'paused' }, focus: '.vn .vplay' }), shot('f-mute-ar', { state: 'call-conv', focus: '#c-mute' }),
  shot('f-end-en', { state: 'call-conv', lang: 'en', appearance: 'light', focus: '#c-end' }), shot('f-pid-en', { state: 'publicid', lang: 'en', appearance: 'light', focus: '#pid-keep' }));

/** The captures kept in the package (captures/): one representative per proof family. */
export const KEEP = ['l-ios-d', 'h-ios-d', 'l-and-d', 'h-and-d', 'vn-ar-paused', 'vn-en-paused', 'ended-ar', 'rec-ar', 'rec-en', 'ca-ar', 'cc-ar', 'ca-en', 'cm-ar',
  'op-ar', 'op-en', 'rep-ar', 'pin-en', 'set-en', 'nt-ar-pro', 'und-ar', 'pid-ar', 'pid-en', 's320-vn-en', 'lg-vn-ar', 'hc-vn-ar', 'f-mute-ar'];
