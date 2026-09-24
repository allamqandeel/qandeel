/* G2.1 — THE BRIDGE into the canonical Living Analysis World.
 *
 * Added to the canonical page at runtime, from outside, exactly as the I-08B1 board server added its
 * own harnesses (`window.__q*`, `window.__r*`). The canonical file's bytes are never touched: it is
 * loaded verbatim and this script is appended to its document afterwards. Everything here calls the
 * page's OWN functions and bindings — `mkFrame`, `fire`, `FREE`, `invalidate`, `nudge`, `CW`, `W`,
 * `WORK`, `EV`, `evseed`, `RMFORCE` — so the world is still painted by the canonical painter and the
 * canonical composite, and nothing is redrawn, approximated or restyled.
 *
 * What the bridge is allowed to do, and nothing else:
 *   - switch on the canonical clean mode (the harness panels are instrumentation, not Product UI);
 *   - place the canonical FREE camera ({cx, cy, field} in world units) and invalidate;
 *   - render one deterministic frame through the canonical export hook `mkFrame` at an explicit clock;
 *   - replay a fixture history through the canonical event channel `fire(kind)` with a pinned seed,
 *     then retime each event onto the proof's clock (settled, or animating from a given instant);
 *   - answer read-only questions (which object is under a point, where an object is, the audit).
 *
 * It adds no stratum, no light, no label and no marker. It never draws.
 */
(function () {
  'use strict';
  if (window.__g21) return;
  var SEED = 90210; // the canonical event seed (`let evseed=mulberry32(90210)`)

  function clean() {
    if (!CLEAN) document.getElementById('bclean').click();
    document.body.setAttribute('data-g21', 'bridge');
    return CLEAN && getComputedStyle(document.getElementById('hud')).display === 'none';
  }
  /* The one camera the Product uses: world-unit framing, not the study's path. `field` is the width of
     the whole stage in world units, exactly the quantity the canonical `tForField` reads, so the
     disclosure parameter A stays the canonical function of the framing. */
  function toFree(c) { return { z: CW / c.field, cx: c.cx, cy: c.cy }; }
  function setCamera(c, moving) {
    FREE = toFree(c); PLAY = null;
    if (moving) nudge();
    invalidate();
    return true;
  }
  function camera() { var k = currentCam(); return { cx: k.cx, cy: k.cy, field: k.field, A: k.t }; }
  /* The canonical path's own framing at A (with the clock at 0, so no pending focus transfer bends it).
     Used to enter FAR / MID / NEAR at exactly the frames the frozen heroes were rendered at. */
  function pathCamera(A) { var k = camAt(A, CW, 0); return { cx: k.cx, cy: k.cy, field: k.field }; }
  /* A frame at an explicit clock, through the canonical export hook, drawn into the visible canvas. */
  function render(c, now) {
    FREE = toFree(c); PLAY = null;              // so read-only probes (`hit`, `camera`) agree with the frame
    var f = mkFrame({ w: CW, h: CH, field: c.field, cx: c.cx, cy: c.cy, now: now });
    vctx.drawImage(f.O, 0, 0);
    return { A: f.cam.t, drawn: f.drawn };
  }
  /* The first-sight caches (`cachedRadial`, the sprite atlas) are filled by whatever a page renders
     first. A Product session reaches NEAR by approaching it, so the proof approaches it too before it
     captures anything: 101 tiny frames along the canonical path. Measured: with this sweep the three
     frozen heroes reproduce at 0 of 2,480,100 px each; without it NEAR and MID do not. */
  function sweep(steps) { var n = steps || 100; for (var i = 0; i <= n; i++) mkFrame({ A: i / n, w: 210, h: 118, now: 0 }); return n + 1; }
  /* The approach as frames that can be spread over idle time (live mode): the same first-sight order. */
  function sweepStep(i, n) { mkFrame({ A: i / n, w: 210, h: 118, now: 0 }); return i < n; }
  /* The frozen hero frames, through the canonical export hook, for the preservation check. */
  function hero(A) { var f = mkFrame({ A: A, w: 2100, h: 1181, now: 0 }); return f.Oc.getImageData(0, 0, 2100, 1181).data; }

  /* ---------------- the fixture history ------------------------------------------------------------
     `script` is [{sp, kind, cam}] — at Session Position `sp` the fixture's conversation committed a turn
     after which QANDEEL's analysis changed by one canonical event. `k` is the effective TC. Events with
     sp <= k are replayed from the built world with the canonical seed; each is retimed:
       settled   -> as if long past (born 0 / t0 far behind): exactly how the world looks once landed
       from T    -> its response starts at instant T on the caller's clock (live or virtual)          */
  function retime(t0real, when) {
    var settled = when == null;
    EV.rel.forEach(function (r) { if (r.born >= t0real - 1) r.born = settled ? 0 : when + (r.born - t0real); });
    W.objects.forEach(function (o) { if (o.born != null && o.born >= t0real - 1) { if (settled) delete o.born; else o.born = when + (o.born - t0real); } });
    EV.xfer.forEach(function (x) { if (x.t0 >= t0real - 1) x.t0 = settled ? -1e9 : when + (x.t0 - t0real); });
    if (WORK.t0 >= t0real - 1) { if (settled) { WORK.from = null; WORK.t0 = -1e9; } else WORK.t0 = when + (WORK.t0 - t0real); }
  }
  function replay(script, k, opts) {
    opts = opts || {};
    var keep = FREE;
    fire('reset');
    evseed = mulberry32(SEED);
    var fired = [];
    for (var i = 0; i < script.length; i++) {
      var e = script[i];
      if (e.sp > k) break;
      FREE = toFree(e.cam);
      var r0 = performance.now();
      var nObj = W.objects.length, nRel = W.relations.length, focusBefore = W.objects.findIndex(function (o) { return o.focus; });
      /* G2.2: the frame's clock is held still for the duration of ONE canonical event, so the event's own delays come
         out exactly as the canonical ones (born = now, now + 140, now + 180) instead of now + however long this load's
         JIT took to reach `const now = performance.now()`. Found by the D5 animation comparison: two loads could
         otherwise start the same event a few ms apart. The canonical bytes and the painter are untouched. */
      performance.now = function () { return r0; };
      try { fire(e.kind); } finally { delete performance.now; }
      var animateFrom = (opts.animate && opts.animate[e.sp] != null) ? opts.animate[e.sp] : null;
      retime(r0, animateFrom);
      fired.push({ sp: e.sp, kind: e.kind, addedObjects: W.objects.length - nObj, addedRelations: W.relations.length - nRel,
        focusFrom: focusBefore, focusTo: W.objects.findIndex(function (o) { return o.focus; }), animated: animateFrom != null });
    }
    FREE = keep;
    invalidate();
    return fired;
  }
  /* Read-only: the world's own state, for the proof's truth logs and checks. */
  function state() {
    var f = W.objects.findIndex(function (o) { return o.focus; });
    var fo = W.objects[f], fs = W.sessions.find(function (s) { return s.focus; });
    return { objects: W.objects.length, relations: W.relations.length, focus: f, focusLabel: fo ? fo.l : null,
      focusSession: fs ? fs.n : null, focusXY: fo ? [fo.x, fo.y] : null, ev: { rel: EV.rel.length, obj: EV.obj.length, xfer: EV.xfer.length, notice: EV.notice.length } };
  }
  /* Which disclosed analytical object sits under a point of the stage (CSS px of the stage). Minor
     (unresolved) material is never a target: it has not earned a name. */
  function hit(sx, sy, radiusCss) {
    var cam = currentCam(), z = cam.z / DPR, best = -1, bd = 1e9;
    var S = schedule(cam.t);
    W.objects.forEach(function (o, i) {
      if (o.minor) return;
      var x = (o.x - cam.cx) * z + innerWidth / 2, y = (o.y - cam.cy) * z + innerHeight / 2;
      var d = Math.hypot(x - sx, y - sy);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0 || bd > radiusCss) return null;
    var o = W.objects[best];
    return { index: best, label: o.l, kind: ['MOMENT', 'THREAD', 'READING', 'MEMO', 'OPEN'][o.k], focus: !!o.focus,
      session: o.s >= 0 ? W.sessions[o.s].n : null, x: o.x, y: o.y, A: cam.t, distance: bd, sched: { lod: S.lod } };
  }
  function objectXY(i) { var o = W.objects[i]; return o ? { x: o.x, y: o.y } : null; }
  function focusIndex() { return W.objects.findIndex(function (o) { return o.focus; }); }
  function setReducedMotion(v) { return window.__setRM(v); }
  function idle() { return !loopOn; }

  window.__g21 = { version: 'G2.2-bridge-1 (G2.1-bridge-1 + a still clock inside one canonical event)', clean: clean, setCamera: setCamera, camera: camera, pathCamera: pathCamera,
    render: render, sweep: sweep, sweepStep: sweepStep, hero: hero, replay: replay, state: state, hit: hit, objectXY: objectXY, focusIndex: focusIndex,
    setReducedMotion: setReducedMotion, idle: idle,
    geometry: function () { return { CW: CW, CH: CH, DPR: DPR, W: innerWidth, H: innerHeight, WC: WC, FAR_W: FAR_W, FAR_H: FAR_H, FIELD_FAR: FIELD_FAR, FIELD_NEAR: FIELD_NEAR }; },
    audit: function () { return window.__audit(); }, typeAudit: function () { return window.__typeAudit(); } };
})();
