/**
 * I-08B3.1-D2R — THE RENDERER. One state vector in, one document out.
 *
 * Four responsibilities live here rather than in the categories, each because putting it in a
 * category would let that category claim something it had not done:
 *
 *   1. THE LIGHT ON THE LIVING BRASS IS DERIVED, from where the light physically is, across
 *      every source in the scene, through the ONE falloff law. A category cannot write "the Q
 *      is lit now"; it can only bring light near the mark, and it cannot do that invisibly.
 *
 *   2. EVERY ANALYTICAL INK IS MIXED ON THE FROZEN NEUTRAL RAMP AND NOWHERE ELSE. There is no
 *      code path in this file by which a node, a membership link, a mark or a keel becomes warm. That is
 *      what turns "light touches the material, the material does not emit" into a measurement.
 *
 *   3. EVERY ATMOSPHERE COLOUR IS A BUILD-TIME CONSTANT, handed in. The renderer cannot invent
 *      a ring colour, so the chroma ceiling cannot be exceeded at runtime.
 *
 *   4. HIDING AN ELEMENT WRITES ITS WHOLE HIDDEN STATE. See `clear`.
 */

import { FOUNDATION, LIGHT, MARK, falloff, markIllumination } from './d2-foundation.mjs';

/* ------------------------------------------------------------------------ magnitudes ---- */
/**
 * Every magnitude the renderer can apply, in one block, in scene pixels and plain ratios.
 *
 * NONE OF THESE IS FROZEN BY THIS PACKAGE. They are the values this proof was drawn with, and
 * D2R_FREEZE_CANDIDATE.md says which of them the token family proposes and which stay as
 * implementation craft parameters, deliberately.
 */
export const MAGNITUDE = {
  /* selection, on the NEUTRAL ramp only */
  MEMBER_LIFT: 0.55,
  MEMBER_WIDTH: 0.45,
  /* the light. 0.62 was the first value, taken from D1's travelling wash, and the first rendered
     frame said it was wrong here: D1's wash is a single bright source on a dark route, while
     these are four or five lobes spread across a field, each carrying a share of one event. A
     meaning event that does not read as an event has failed before anyone judges its taste. */
  WASH_OPACITY: 0.86,
  /* structure. EVERY MEMBERSHIP LINK USES THE SAME TWO NUMBERS — there is no per-link width and
     no per-link opacity, because either would be a strength, and a set has no strengths. Guard
     S3 measures that on the written attributes rather than trusting this comment. */
  LINK_WIDTH: 1.25,
  LINK_OPACITY: 0.80,
  MARK_OPACITY: 0.92,
  LOCUS_RISE_PX: 3.0,
  KEEL_WIDTH: 1.4,
  /* the emerging node */
  NODE_BLUR_PX: 0.9,
  NODE_RISE_PX: 3.0,
  /* the field's acknowledgement — opacity and nothing else */
  RECEDE_OPACITY: 0.34,
  /* parallax */
  PARALLAX_MAX_PX: 64,
};

/* ------------------------------------------------------------------------ colour -------- */
/**
 * Gamma-space channel mix, matching what the browser does when it composites. Used ONLY
 * between two values of the frozen reading ramp.
 */
export const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  const k = Math.max(0, Math.min(1, t));
  return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * k).toString(16).padStart(2, '0')).join('');
};

/* -------------------------------------------------------------------------- clear ------- */
/**
 * HIDE AN ELEMENT COMPLETELY, and the emphasis is on completely.
 *
 * I-08B3.1-D1 found a defect three packages old by hashing the document instead of the pixels:
 * every branch that hid an element wrote only its opacity, or only its `display`, and left its
 * geometry, path data and dash pattern at whatever the last frame that used them had set.
 * Nothing painted, so nothing looked wrong — until one page was asked to render several
 * sequences and a frame of one carried another's leftovers.
 *
 * D2 renders FOUR categories from ONE page, so the same defect here would be four times as
 * likely and exactly as invisible. An element that is not in use is put into the same condition
 * no matter what used it last, and the per-frame DOM digest in the capture proves it.
 */
const clear = (node, attrs = []) => {
  if (!node) return;
  for (const a of attrs) node.removeAttribute(a);
  node.style.strokeDasharray = '';
  node.style.strokeDashoffset = '';
  node.style.strokeWidth = '';
  node.style.filter = '';
  node.style.transform = '';
  node.style.transformOrigin = '';
  node.style.opacity = '0';
};

/**
 * `transformOrigin` AND `strokeWidth` ARE IN THAT LIST BECAUSE THE DIGEST FOUND THEM, and the
 * finding is worth more than the fix.
 *
 * D1 caught this defect once, for `display` and `opacity`, and fixed those two. It came back
 * here as two DIFFERENT properties: INSIGHT uses five light sources and PATTERN uses four, so
 * `src-4` is hidden whenever PATTERN runs — and it kept INSIGHT's `transform-origin`. The
 * rasters were identical at all 210 frames, because an element at opacity 0 paints nothing.
 *
 * The lesson is not "remember these two as well". It is that HIDING BY LISTING PROPERTIES is a
 * list that goes stale every time the renderer learns to write a new one, and the only thing
 * that keeps it honest is an instrument that reads the whole document instead of the picture.
 * Check R2 is that instrument, and it is the reason this was a ten-minute fix rather than a
 * defect that shipped in a fourth consecutive package.
 */

/* ------------------------------------------------------------------------- renderer ----- */
export function makeRenderer(doc, FIELD, WORLDS, PARALLAX, MAG = MAGNITUDE) {
  const $ = (id) => doc.getElementById(id);

  const planes = [0, 1, 2].map((p) => $(`plane-${p}`));
  const labelPlanes = [0, 1, 2].map((p) => $(`labels-${p}`));
  const rings = [...doc.querySelectorAll('.ring')];
  const fills = [...doc.querySelectorAll('.ring-fill')];
  const labels = [...doc.querySelectorAll('.topic-label')];
  const srcs = [0, 1, 2, 3, 4, 5].map((i) => $(`src-${i}`));
  const el = {
    atmos: $('atmos'),
    links: [0, 1, 2, 3].map((i) => $(`link-${i}`)),
    marks: [0, 1, 2, 3].map((i) => $(`mark-${i}`)),
    locusMark: $('plocus-mark'),
    locus: $('plocus'),
    locusText: $('plocus-text'),
    keel: $('keel'),
    inode: $('inode'),
    inodeText: $('inode-text'),
    inodeLabel: $('inode-label'),
    qLight: $('q-light'),
  };

  const keelLen = el.keel ? el.keel.getTotalLength() : 0;
  const linkLens = el.links.map((t) => (t ? t.getTotalLength() : 0));

  /**
   * Show exactly the first `f` of a path and nothing else.
   *
   * Inherited from D1, including the reason it is written this way: the obvious
   * `dasharray: "len rest"` with a zero-length first dash paints a ROUND DOT under
   * `stroke-linecap: round`, so every partially drawn path also draws a bright point at its
   * start in every frame. It looks like a deliberate anchor. It is a linecap.
   */
  const drawFraction = (node, L, f, opacity) => {
    const len = Math.max(0, Math.min(1, f)) * L;
    node.style.strokeDasharray = `${len.toFixed(3)} ${(L + 1).toFixed(3)}`;
    node.style.strokeDashoffset = '0';
    node.style.opacity = opacity.toFixed(4);
  };

  return function apply(S) {
    const world = WORLDS[S.world || 'personal'];
    const members = new Set(S.members || []);
    const lift = S.memberLift || 0;
    const recede = S.fieldRecede || 0;

    /* ---- 1. THE FIELD. Static geometry, world styling, the user's hand, one acknowledgement. */
    for (let p = 0; p < 3; p++) {
      const rate = S.reduced ? PARALLAX[0] : PARALLAX[p];
      const dx = (S.dx || 0) * rate;
      planes[p].style.transform = `translateX(${dx.toFixed(3)}px)`;
      labelPlanes[p].style.transform = `translateX(${dx.toFixed(3)}px)`;
    }

    for (const r of rings) {
      const ti = +r.dataset.topic;
      const ri = +r.dataset.ring;
      const t = FIELD[ti];
      if (ri >= world.ringLimit || ri >= t.rings.length) { clear(r, []); continue; }
      const isMember = members.has(t.id);
      const base = world.strokeAlpha[ri] * (1 - MAG.RECEDE_OPACITY * recede);
      r.style.opacity = (base * (isMember ? 1 + MAG.MEMBER_LIFT * lift : 1)).toFixed(4);
      r.style.strokeWidth = ((ri === 0 ? 1.15 : 0.85) + (isMember ? MAG.MEMBER_WIDTH * lift : 0)).toFixed(3);
      /* ONE dash for the whole world, or none. In I-08B3.1-D2 this read `t.dash` — a PER-TOPIC
         pattern derived from a per-topic "shared fraction" — which is the invented quantity the
         D2R correction removes. The dash now says which world is open and nothing else. */
      if (world.dash) {
        r.style.strokeDasharray = world.dash;
        r.style.strokeDashoffset = '0';
      } else {
        r.style.strokeDasharray = '';
        r.style.strokeDashoffset = '';
      }
    }

    for (const f of fills) {
      const t = FIELD[+f.dataset.topic];
      f.style.opacity = (world.fillAlpha * (1 - MAG.RECEDE_OPACITY * recede)
        * (members.has(t.id) ? 1 + 0.7 * lift : 1)).toFixed(4);
    }

    /* EVERY TOPIC IS NAMED IN EVERY WORLD. D2's Public world dropped labels below a depth and
       justified it as "less of the world is resolved to you", which is a claim about knowledge
       that nothing granted. The Public treatment is now a uniform dimming of the whole field,
       labels included, and a reader can always tell what a ring is. */
    for (const lb of labels) {
      const t = FIELD[+lb.dataset.topic];
      const isMember = members.has(t.id);
      const depth = t.layer === 0 ? 0.92 : t.layer === 1 ? 0.76 : 0.58;
      lb.style.opacity = (depth * world.labelAlpha * (1 - 0.45 * recede)).toFixed(4);
      /* THE ONLY THING SELECTION DOES TO INK: move it along the FROZEN NEUTRAL RAMP. There is
         no third argument to this call and no warm constant in scope at this call site. */
      lb.style.color = isMember ? mix(FOUNDATION.TERTIARY, FOUNDATION.PRIMARY, lift) : FOUNDATION.TERTIARY;
    }

    /* ---- 2. THE LIGHT. Up to six sources, all through one gradient at one opacity. --------- */
    const sources = S.sources || [];
    for (let i = 0; i < srcs.length; i++) {
      const s = sources[i];
      if (!s || s.level <= 0.002) { clear(srcs[i], ['cx', 'cy', 'rx', 'ry']); continue; }
      const rx = s.r * (1 + 0.55 * (s.elong || 0));
      const ry = s.r * (1 - 0.30 * (s.elong || 0));
      srcs[i].setAttribute('cx', s.x.toFixed(2));
      srcs[i].setAttribute('cy', s.y.toFixed(2));
      srcs[i].setAttribute('rx', rx.toFixed(2));
      srcs[i].setAttribute('ry', ry.toFixed(2));
      srcs[i].style.transform = `rotate(${(s.angle || 0).toFixed(2)}deg)`;
      srcs[i].style.transformOrigin = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
      srcs[i].style.opacity = (s.level * MAG.WASH_OPACITY).toFixed(4);
      srcs[i].style.strokeDasharray = '';
      srcs[i].style.strokeDashoffset = '';
      srcs[i].style.filter = '';
    }

    /* ---- 3. THE PATTERN'S STRUCTURE. Membership, and nothing but membership. ---------------
       Neutral, always, at the canonical analytical relation and node inks.

       EVERY LINK IS WRITTEN FROM THE SAME TWO NUMBERS AND THE SAME DRAWN FRACTION. There is no
       index in this loop that reaches a magnitude — no stagger, no per-member width, no
       per-member opacity. A stagger would be an order and a width would be a strength, and the
       Product knows neither: it knows a SET. The `i` below indexes elements, never values.

       The house guidance calls simultaneous entrance a defect and it is right about lists of
       unrelated items. This is one object with four arms, and equality is the semantic
       requirement — so the craft default is inverted deliberately, and recorded. */
    const linkLevel = S.linkLevel !== undefined ? S.linkLevel : (S.linkDraw || 0);
    for (let i = 0; i < el.links.length; i++) {
      if ((S.linkDraw || 0) <= 0 || linkLevel <= 0.002) { clear(el.links[i], []); clear(el.marks[i], []); continue; }
      el.links[i].style.strokeWidth = MAG.LINK_WIDTH.toFixed(2);
      drawFraction(el.links[i], linkLens[i], S.linkDraw, linkLevel * MAG.LINK_OPACITY);
    }
    for (let i = 0; i < el.marks.length; i++) {
      if ((S.markReveal || 0) <= 0.002) { clear(el.marks[i], []); continue; }
      el.marks[i].style.opacity = (S.markReveal * MAG.MARK_OPACITY).toFixed(4);
      el.marks[i].style.strokeWidth = MAG.LINK_WIDTH.toFixed(2);
    }

    /* The pattern's own analytical object. An ordinary node — same ink, same plane, same kind of
       thing as every other node on the map. Its POSITION is authored layout and means nothing. */
    const lr = S.locusReveal || 0;
    if (lr <= 0.001) {
      clear(el.locusMark, []);
      el.locus.style.opacity = '0';
      el.locus.style.transform = 'translate(-50%,-50%)';
    } else {
      el.locusMark.style.opacity = lr.toFixed(4);
      el.locusMark.style.strokeWidth = MAG.LINK_WIDTH.toFixed(2);
      el.locus.style.opacity = lr.toFixed(4);
      el.locus.style.transform = `translate(-50%,-50%) translateY(${(MAG.LOCUS_RISE_PX * (1 - lr)).toFixed(3)}px)`;
    }

    const keelLevel = S.keelLevel !== undefined ? S.keelLevel : (S.keelDraw || 0);
    if ((S.keelDraw || 0) > 0 && keelLevel > 0.002) {
      el.keel.style.strokeWidth = MAG.KEEL_WIDTH.toFixed(2);
      drawFraction(el.keel, keelLen, S.keelDraw, keelLevel);
    } else {
      clear(el.keel, []);
    }

    /* ---- 4. THE EMERGING NODE. Resolves out of the gathering; never emits. ----------------- */
    const rev = S.nodeReveal || 0;
    /**
     * THE CENTRING IS PART OF EVERY TRANSFORM WRITTEN HERE, and that is not belt-and-braces.
     *
     * The node is centred on its site by a stylesheet `translate(-50%,-50%)`. Writing
     * `style.transform = 'translateY(...)'` does not ADD to that — it REPLACES it, so the
     * element jumped to having its left edge on the site and ran 80 px off the right of the
     * frame. The first diagnosis of that was "the string is too long at 18 px", which was
     * wrong, and shrinking the type would have hidden the defect at every size but the one
     * where it reappeared. The measurement that settled it was a bounding rect, not a look.
     */
    const centre = 'translate(-50%,-50%)';
    if (rev <= 0.001) {
      el.inode.style.opacity = '0';
      el.inode.style.filter = '';
      el.inode.style.transform = centre;
      el.inodeText.style.color = FOUNDATION.TERTIARY;
    } else {
      const blur = MAG.NODE_BLUR_PX * (S.nodeBlur || 0);
      el.inode.style.opacity = rev.toFixed(4);
      el.inode.style.filter = blur > 0.01 ? `blur(${blur.toFixed(3)}px)` : 'none';
      el.inode.style.transform = `${centre} translateY(${(MAG.NODE_RISE_PX * (1 - rev)).toFixed(3)}px)`;
      el.inodeText.style.color = mix(FOUNDATION.SECONDARY, FOUNDATION.PRIMARY, rev);
    }

    /* ---- 5. LIGHT ON THE MATERIAL. DERIVED, never written. --------------------------------
       `skipMark` is set in exactly one place: while the inherited CONNECTION control is running,
       D1's own renderer owns this element and derives the same quantity from its own sources.
       Two writers on one property is how a value ends up depending on call order. */
    let q = 0;
    if (!S.skipMark) {
      q = markIllumination(sources, { x: MARK.cx, y: MARK.cy });
      el.qLight.style.opacity = q > 0.003 ? q.toFixed(4) : '0';
    }

    return { qLight: q, sourceCount: sources.length };
  };
}

/** Hides every D2-owned event element completely. Used while the CONNECTION control is running. */
export function makeEventHider(doc) {
  const nodes = [
    ...[0, 1, 2, 3, 4, 5].map((i) => doc.getElementById(`src-${i}`)),
    ...[0, 1, 2, 3].map((i) => doc.getElementById(`link-${i}`)),
    ...[0, 1, 2, 3].map((i) => doc.getElementById(`mark-${i}`)),
    doc.getElementById('plocus-mark'),
    doc.getElementById('keel'),
  ];
  const inode = doc.getElementById('inode');
  const locus = doc.getElementById('plocus');
  return function hide() {
    for (const n of nodes) clear(n, ['cx', 'cy', 'rx', 'ry']);
    for (const d of [inode, locus]) {
      d.style.opacity = '0';
      d.style.filter = '';
      d.style.transform = 'translate(-50%,-50%)';
    }
  };
}

export const LIGHT_STOPS = LIGHT;
export { falloff };
