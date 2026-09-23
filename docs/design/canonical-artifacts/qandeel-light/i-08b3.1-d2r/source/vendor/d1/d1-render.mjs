/**
 * I-08B3.1-D1 — THE RENDERER.
 *
 * The single place where a STATE vector becomes pixels. All six apply functions — three
 * arrivals and their three reduced-motion counterparts — go through this one function, so any
 * difference a reviewer sees between them came from the state and from nowhere else.
 *
 * FOUR RESPONSIBILITIES LIVE HERE RATHER THAN IN THE ARRIVALS, each because putting it in an
 * arrival would let a direction claim something it had not actually done:
 *
 *  1. qLight. Living Brass receiving illumination is the composition the material contract is
 *     about, and it would be trivially fakeable if a direction could write "the Q is lit now".
 *     The renderer DERIVES it from where the light PHYSICALLY is — every warm source in the
 *     scene, not a chosen one. A direction cannot light the Brass without bringing light near
 *     it, and cannot bring light near it without that light being visible on its way.
 *
 *  2. THE DESTINATION'S INK IS MIXED ON THE NEUTRAL RAMP AND NOWHERE ELSE. `receptionLift`
 *     interpolates between two frozen reading-ramp values. There is no code path by which the
 *     destination's text can become warm, in any direction, at any millisecond — which is what
 *     turns "touched by light, not turned into a lamp" from a description into guard G3.
 *
 *  3. THE SETTLED FRAME. When `relationDraw` reaches 1 the dash pattern is removed entirely
 *     rather than set to a full-length dash, so `relationOrigin` cannot leave a trace; and the
 *     provisional relation is not merely transparent at the end, it is `display:none`, so a
 *     sub-pixel of antialiasing from a stroke nobody can see cannot reach the settled raster.
 *
 *  4. THE TRANSIENT BLUR IS CLAMPED, IN ONE PLACE. D0 measured that 1.15 CSS px of blur at
 *     dpr 2 destroyed the 11.5 px standing label under the destination — the thing at depth
 *     stopped being "previously known" and became unreadable, which is a different claim. The
 *     bridging blur is capped here so no direction can exceed it by choosing a larger number.
 */
import {
  FOUNDATION, CHROME, LIGHT, GEO, priorAt, curvePath, curvePathProvisional, curveAngle, curveAt,
} from './d1-scene.mjs';

/* ------------------------------------------------------------------ colour utils ----- */
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const px = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/**
 * Mixed in gamma-encoded sRGB — the space every CSS colour interpolation and every alpha
 * composite on this page already happens in. Mixing here in a different space would make the
 * text colours disagree with the washes drawn behind them.
 */
export const mix = (a, b, t) => {
  const k = Math.max(0, Math.min(1, t));
  const A = hx(a), B = hx(b);
  return px(A.map((v, i) => v + (B[i] - v) * k));
};
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/* --------------------------------------------------- the arrival's fixed magnitudes -- */
/**
 * Every arrival channel is a 0..1 weight. The PHYSICAL SIZE of what it does is declared here,
 * once, so that the three directions differ in when and how much of a thing happens and never
 * in what the thing is. A direction asking for 0.8 of the reception gets 0.8 of exactly these.
 *
 * None of these numbers is a proposal and none of them is canonical. D1 freezes no timing, no
 * easing and no magnitude.
 */
export const ARRIVAL_MAGNITUDE = {
  /**
   * Extra blur on the destination's TEXT, in CSS px, at receptionBlur = 1.
   *
   * Was 0.5, and the first captured arrival frame settled it: at 0.5 the destination reads as
   * OUT OF FOCUS at the moment of contact rather than as one thing resolving. A bridge that the
   * eye notices as a blur has stopped being a bridge.
   */
  BLUR_PX: 0.34,
  /** Hard ceiling on the TOTAL blur the destination's text may ever carry, in CSS px. */
  BLUR_CEILING_PX: 0.95,
  /** Scale compression at receptionPress = 1. */
  PRESS: 0.014,
  /** Follow-through displacement along the arrival tangent, in CSS px, at priorSettle = 1. */
  SETTLE_PX: 1.5,
  /** How far along the NEUTRAL ramp toward PRIMARY receptionLift = 1 carries the ink. */
  LIFT: 0.82,
  /**
   * THE RECEPTION POOL — and the correction that came out of LOOKING AT THE FIRST FRAME.
   *
   * The first build drew it as a near-circular radial at 0.46 opacity, centred exactly on the
   * destination, and the argument for it was that it was "on the ground, not on the object". The
   * rendered frame did not agree: a bright warm radial centred on an object reads as light coming
   * OUT of the object, whatever the paint order says. It was the generic glow the brief forbids,
   * arrived at through a sentence rather than through a decision.
   *
   * What separates illumination from emission on a raster is not where a thing is drawn. It is
   * SHAPE, LEVEL and DIRECTION:
   *
   *   FLAT AND WIDE — 124 x 20 rather than 92 x 34. A pool on a ground plane seen at a shallow
   *   angle is an ellipse lying down, not a disc standing up.
   *
   *   OFFSET AND ROTATED — carried 18 px along the tangent the light actually arrived on, and
   *   turned to it. Light continues past what it lands on; a patch centred exactly on the object
   *   is the signature of the object being the source.
   *
   *   DIMMER — 0.22 rather than 0.46. Half the level of the version that read as a glow.
   *
   * And the reception gains a NEUTRAL half at the same moment: the destination's own presence
   * ellipse firms under it (see the renderer). "The object gained footing" is a thing a surface
   * does when it is lit, and it carries none of the warmth.
   */
  GROUND_OPACITY: 0.22,
  GROUND_RX: 124,
  GROUND_RY: 20,
  /** How far along the arrival tangent the lit patch is carried, in scene px. */
  GROUND_OFFSET_PX: 18,
  /** Extra opacity on the destination's own neutral presence ellipse, at receptionGround = 1. */
  PRESENCE_GAIN: 0.34,
  /** The provisional relation: segment and gap as fractions of the curve's length. */
  PROV_SEG: 0.085,
  PROV_GAP: 0.055,
  /** Its opacity at relationProvisional = 1. Never above the canonical stroke's own. */
  PROV_OPACITY: 0.52,
};

/* ------------------------------------------------------- derived: light on the Q ----- */
/**
 * How much light the Living Brass mark receives, given where the light actually is.
 *
 * A DIAGNOSTIC optical model, stated rather than tuned, unchanged from D0 except that it now
 * considers EVERY warm source in the scene rather than only the travelling one:
 *
 *     reach  = radius * (REACH_BASE + REACH_PER_LEVEL * level)
 *     qLight = level * clamp(1 - distance/reach)^FALLOFF * Q_RECEPTION
 *
 * evaluated for the travelling wash AND for the reception pool, taking the larger. D1 adds a
 * second light source, and a reception model that kept looking only at the first would report
 * zero for a mark the new source was standing next to. It reports zero here because the pool is
 * 494 px away from the mark, which is a fact about the geometry — not because it was not asked.
 *
 * The consequence that matters: qLight is 0 whenever there is no light in the scene, so the
 * settled frame shows unmodified material as a matter of arithmetic.
 */
export const RECEPTION = { REACH_BASE: 1.5, REACH_PER_LEVEL: 2.5, FALLOFF: 0.7, Q_RECEPTION: 0.75 };

const receivedFrom = (x, y, r, level) => {
  if (level <= 0 || r <= 0) return 0;
  const reach = r * (RECEPTION.REACH_BASE + RECEPTION.REACH_PER_LEVEL * level);
  const prox = clamp(1 - Math.hypot(x - GEO.q.cx, y - GEO.q.cy) / reach);
  return level * Math.pow(prox, RECEPTION.FALLOFF) * RECEPTION.Q_RECEPTION;
};

export function qLightFrom(S) {
  const p = priorAt(S.priorTravel);
  return Math.max(
    receivedFrom(S.washX, S.washY, S.washR, S.washLevel),
    receivedFrom(p.x, p.y, ARRIVAL_MAGNITUDE.GROUND_RX,
      S.receptionGround * ARRIVAL_MAGNITUDE.GROUND_OPACITY),
  );
}

/* ----------------------------------------------------------------------- render ------ */
export function makeRenderer(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    prior: $('prior'), priorText: $('prior-text'), priorLabel: $('prior-label'),
    priorGround: $('prior-ground'),
    ghost: $('prior-ghost'),
    current: $('current'), currentText: $('current-text'),
    wash: $('wash'), recv: $('recv'),
    relation: $('relation'), relationProv: $('relation-prov'),
    threadTail: $('thread-tail'), threadMid: $('thread-mid'), threadCore: $('thread-core'),
    threadHalo: $('thread-halo'), threadHead: $('thread-head'),
    quiet: $('quiet'), qLight: $('q-light'),
  };
  /** Every path that lives on the CANONICAL curve. One `d`, assigned to all of them, per frame. */
  const onCurve = [
    el.relation, el.threadHalo, el.threadTail, el.threadMid, el.threadCore,
  ];

  /**
   * Show exactly the sub-span [lo, lo+len] of a path, and NOTHING else.
   *
   * The obvious spelling — `stroke-dasharray: "0 lo len rest"` — is wrong in a way that is
   * invisible until you look at a frame: a ZERO-LENGTH dash under `stroke-linecap: round` is
   * painted as a round DOT, so every dashed element also draws a bright point at the very start
   * of the relation in every frame. It looks like a deliberate anchor. It is a linecap.
   *
   * Offsetting a two-entry pattern has no zero-length dash to render. The offset is taken
   * positive modulo the period, because a negative `stroke-dashoffset` is an error in SVG 1.1
   * and only works by browser grace.
   */
  const dash = (node, lo, len, opacity, L) => {
    const gap = L + 1;
    const period = len + gap;
    node.style.strokeDasharray = `${len.toFixed(3)} ${gap.toFixed(3)}`;
    node.style.strokeDashoffset = (((period - lo) % period + period) % period).toFixed(3);
    node.style.opacity = opacity.toFixed(4);
  };

  /**
   * THE DOCUMENT IS A PURE FUNCTION OF THE STATE, AND THIS IS WHAT MAKES IT ONE.
   *
   * Every branch below that hides an element used to write only its opacity — or only its
   * `display` — and leave its geometry, its path data and its dash pattern at whatever the last
   * frame that used it had set. Nothing painted, so nothing was visibly wrong, and for six
   * packages nothing was.
   *
   * It became visibly wrong the moment this package started hashing the DOM instead of only the
   * pixels. Capturing seven sequences from one page, direction C's frame 0 carried direction B's
   * leftover relation path, and the second capture of direction A carried the reduced-motion
   * counterpart's — so three directions that draw the same thing hashed to three different
   * documents. The instrument was right and the renderer was sloppy.
   *
   * `clear()` writes the hidden state completely, so an element that is not being used is in the
   * same condition no matter what used it last.
   */
  const clear = (node, attrs) => {
    for (const a of attrs) node.removeAttribute(a);
    node.style.strokeDasharray = '';
    node.style.strokeDashoffset = '';
    node.style.opacity = '0';
  };

  return function render(S) {
    /* ---- the one curve, rebuilt because one of its two ends is moving --------------- */
    const d = curvePath(S.priorTravel);
    for (const n of onCurve) n.setAttribute('d', d);
    const L = el.relation.getTotalLength();

    /* ---- the destination ------------------------------------------------------------ */
    const p = priorAt(S.priorTravel);
    const baseInk = mix(FOUNDATION.TERTIARY, FOUNDATION.SECONDARY, S.priorTravel);

    // The follow-through continues PAST the destination along the direction the meaning
    // arrived from, then returns to zero. It is an additive offset, so the settled position is
    // exactly priorAt(1) in every direction.
    const ang = (curveAngle(S.priorTravel, 1) * Math.PI) / 180;
    const off = S.priorSettle * ARRIVAL_MAGNITUDE.SETTLE_PX;
    el.prior.style.left = `${(p.x + Math.cos(ang) * off).toFixed(3)}px`;
    el.prior.style.top = `${(p.y + Math.sin(ang) * off).toFixed(3)}px`;

    const press = 1 - ARRIVAL_MAGNITUDE.PRESS * S.receptionPress;
    // toFixed(4) and not more, so that at press = 0 this string is CHARACTER-IDENTICAL to the
    // one D0R wrote. The shared CONNECT phase is compared against D0R's own captured rasters,
    // and a wider precision here would move a sub-pixel and cost that comparison for nothing.
    el.prior.style.transform = `translate(-50%, -50%) scale(${(p.scale * press).toFixed(4)})`;
    el.prior.style.opacity = (p.opacity * S.priorReveal).toFixed(4);
    el.priorText.style.fontVariationSettings = `'wght' ${Math.round(p.weight)}`;

    // THE ONE PLACE THE DESTINATION'S INK IS DECIDED. Two frozen reading-ramp values and a
    // weight between them. There is no third argument and no warm constant in scope.
    el.priorText.style.color = mix(baseInk, FOUNDATION.PRIMARY, S.receptionLift * ARRIVAL_MAGNITUDE.LIFT);

    // The bridging blur, clamped here rather than trusted to the caller, and applied to the
    // WHOLE destination — text and standing label together — exactly as D0R applied the depth
    // blur. Blurring only the text would sharpen the 11.5 px label at depth, which is a change
    // to the inherited Guided Thread rather than to the arrival.
    const blur = Math.min(
      ARRIVAL_MAGNITUDE.BLUR_CEILING_PX,
      p.blur + ARRIVAL_MAGNITUDE.BLUR_PX * S.receptionBlur,
    );
    el.prior.style.filter = blur > 0.01 ? `blur(${blur.toFixed(3)}px)` : 'none';
    el.priorLabel.style.opacity = (0.72 - 0.22 * S.priorTravel).toFixed(3);

    // The destination's own presence — NEUTRAL, and the half of the reception that carries no
    // warmth at all. A lit patch of ground makes the thing standing on it read as more solid, so
    // the presence ellipse firms and widens by the same weight that brings the light.
    const firm = S.receptionGround * ARRIVAL_MAGNITUDE.PRESENCE_GAIN;
    el.priorGround.setAttribute('cx', p.x.toFixed(2));
    el.priorGround.setAttribute('cy', p.y.toFixed(2));
    el.priorGround.setAttribute('rx', (74 * p.scale * (1 + 0.10 * S.receptionGround)).toFixed(2));
    el.priorGround.setAttribute('ry', (30 * p.scale * (1 + 0.10 * S.receptionGround)).toFixed(2));
    el.priorGround.style.opacity = (0.38 + firm).toFixed(4);

    /* ---- the depth rendering the reduced-motion counterpart crossfades FROM ---------- */
    // Held at priorAt(0) permanently; only its opacity is ever written. In the full-motion
    // directions priorGhost is 0 at every millisecond, so this element contributes nothing and
    // the rasters are the same as if it did not exist.
    if (S.priorGhost > 0.002) {
      const g = priorAt(0);
      el.ghost.style.display = 'block';
      el.ghost.style.opacity = (g.opacity * S.priorGhost).toFixed(4);
    } else {
      // BOTH properties, not just `display`. Writing only the one that hides it leaves the other
      // at whatever the last frame that showed it set — which is invisible on the raster and is
      // exactly what stopped the document being a pure function of the state. See `clear()`.
      el.ghost.style.display = 'none';
      el.ghost.style.opacity = '0';
    }

    /* ---- the current statement ------------------------------------------------------ */
    const o = S.currentOrient;
    el.current.style.transform =
      `translate(-50%, -50%) translate(${(-5.5 * o).toFixed(3)}px, ${(-3.2 * o).toFixed(3)}px) scale(${(1 + 0.016 * o).toFixed(5)})`;
    el.currentText.style.color = mix(FOUNDATION.PRIMARY, LIGHT.CORE, S.currentLight * 0.55);
    el.currentText.style.textShadow = S.currentLight > 0.004
      ? `0 0 ${(8 + 10 * S.currentLight).toFixed(1)}px rgba(254,241,214,${(0.24 * S.currentLight).toFixed(4)})`
      : 'none';

    /* ---- the travelling light's own presence in the world -------------------------- */
    if (S.washLevel > 0.001) {
      const e = S.washElong;
      const rx = S.washR * (1 + 0.62 * e);
      const ry = S.washR * (1 - 0.34 * e);
      const wa = curveAngle(S.priorTravel, S.threadPos);
      el.wash.setAttribute('cx', S.washX.toFixed(2));
      el.wash.setAttribute('cy', S.washY.toFixed(2));
      el.wash.setAttribute('rx', rx.toFixed(2));
      el.wash.setAttribute('ry', ry.toFixed(2));
      el.wash.setAttribute('transform', `rotate(${wa.toFixed(2)} ${S.washX.toFixed(2)} ${S.washY.toFixed(2)})`);
      el.wash.style.opacity = (S.washLevel * 0.62).toFixed(4);
    } else {
      clear(el.wash, ['cx', 'cy', 'rx', 'ry', 'transform']);
    }

    /* ---- the reception pool: warm light ON THE GROUND, never on the glyphs ---------- */
    // Flat and wide, drawn under the destination and BEHIND it in paint order. It is the only
    // warm thing any arrival direction adds, and it is a pool on a surface.
    if (S.receptionGround > 0.002) {
      // Carried along the tangent the light actually arrived on, and turned to it. See the note
      // on ARRIVAL_MAGNITUDE.GROUND_OPACITY for why the shape and the offset are the difference
      // between a lit patch of ground and a lamp.
      const gx = p.x + Math.cos(ang) * ARRIVAL_MAGNITUDE.GROUND_OFFSET_PX;
      const gy = p.y + Math.sin(ang) * ARRIVAL_MAGNITUDE.GROUND_OFFSET_PX;
      const deg = (ang * 180) / Math.PI;
      el.recv.setAttribute('cx', gx.toFixed(2));
      el.recv.setAttribute('cy', gy.toFixed(2));
      el.recv.setAttribute('rx', ARRIVAL_MAGNITUDE.GROUND_RX.toFixed(2));
      el.recv.setAttribute('ry', ARRIVAL_MAGNITUDE.GROUND_RY.toFixed(2));
      el.recv.setAttribute('transform', `rotate(${deg.toFixed(2)} ${gx.toFixed(2)} ${gy.toFixed(2)})`);
      el.recv.style.opacity = (S.receptionGround * ARRIVAL_MAGNITUDE.GROUND_OPACITY).toFixed(4);
    } else {
      clear(el.recv, ['cx', 'cy', 'rx', 'ry', 'transform']);
    }

    /* ---- the provisional relation --------------------------------------------------- */
    // `display:none` rather than opacity 0: a stroke at opacity 0 still costs nothing visually
    // but a sub-pixel of antialiasing from a rounding difference would land in the settled
    // raster, and the settled raster is compared byte for byte across all three directions.
    if (S.relationProvisional > 0.002) {
      el.relationProv.style.display = 'block';
      el.relationProv.setAttribute('d', curvePathProvisional(S.priorTravel, S.relationConverge));
      const seg = L * ARRIVAL_MAGNITUDE.PROV_SEG;
      const gap = Math.max(0, L * ARRIVAL_MAGNITUDE.PROV_GAP * (1 - S.relationConverge));
      el.relationProv.style.strokeDasharray = `${seg.toFixed(3)} ${gap.toFixed(3)}`;
      el.relationProv.style.strokeDashoffset = '0';
      el.relationProv.style.opacity =
        (S.relationProvisional * ARRIVAL_MAGNITUDE.PROV_OPACITY).toFixed(4);
    } else {
      el.relationProv.style.display = 'none';
      clear(el.relationProv, ['d']);
    }

    /* ---- the canonical relation ----------------------------------------------------- */
    const level = clamp(S.relationLevel);
    if (S.relationDraw >= 1) {
      // No dash at all, so relationOrigin cannot survive into the settled frame.
      el.relation.style.strokeDasharray = 'none';
      el.relation.style.strokeDashoffset = '0';
      el.relation.style.opacity = level.toFixed(4);
    } else if (S.relationDraw <= 0 || level <= 0.002) {
      // `d` is NOT cleared here: the relation is one of the paths rebuilt every frame from the
      // curve, so its path data is a function of priorTravel whether or not it is visible.
      el.relation.style.strokeDasharray = '';
      el.relation.style.strokeDashoffset = '';
      el.relation.style.opacity = '0';
    } else {
      const shown = L * S.relationDraw;
      dash(el.relation, (L - shown) * S.relationOrigin, shown, level, L);
    }

    /* ---- the travelling trace ------------------------------------------------------- */
    /**
     * Four nested windows behind one head rather than one dash, because a dash of constant
     * width and constant brightness is A LINE BEING DRAWN — the first version of this looked
     * exactly like a cable, which is the one thing the brief names twice. Light has a bright
     * short head and a long dim wake.
     */
    if (S.threadLevel > 0.002) {
      const head = L * S.threadPos;
      const window = (fracLen, alpha, node) => {
        const len = Math.max(0.01, Math.min(head, L * fracLen));
        dash(node, head - len, len, S.threadLevel * alpha, L);
      };
      window(0.34, 0.85, el.threadHalo);
      window(0.30, 0.26, el.threadTail);
      window(0.13, 0.58, el.threadMid);
      window(0.045, 1.00, el.threadCore);
      const [hx2, hy2] = curveAt(S.priorTravel, S.threadPos);
      el.threadHead.setAttribute('cx', hx2.toFixed(2));
      el.threadHead.setAttribute('cy', hy2.toFixed(2));
      el.threadHead.style.opacity = S.threadLevel.toFixed(4);
    } else {
      for (const n of [el.threadHalo, el.threadTail, el.threadMid, el.threadCore]) {
        n.style.strokeDasharray = '';
        n.style.strokeDashoffset = '';
        n.style.opacity = '0';
      }
      clear(el.threadHead, ['cx', 'cy']);
    }

    /* ---- quiet analytical material, acknowledging and returning -------------------- */
    el.quiet.style.opacity = (1 - 0.54 * S.fieldRecede).toFixed(4);
    el.quiet.style.filter = S.fieldRecede > 0.01 ? `blur(${(0.85 * S.fieldRecede).toFixed(3)}px)` : 'none';
    el.quiet.style.transform = `scale(${(1 - 0.035 * S.fieldRecede).toFixed(5)})`;

    /* ---- light ON the Living Brass, derived from where the light actually is ------ */
    const q = qLightFrom(S);
    el.qLight.style.opacity = q > 0.003 ? q.toFixed(4) : '0';
    return { qLight: q, blur, curveLength: L };
  };
}
