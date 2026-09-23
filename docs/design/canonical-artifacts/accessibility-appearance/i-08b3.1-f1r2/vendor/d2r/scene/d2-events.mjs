/**
 * I-08B3.1-D2R — THE THREE MEANING EVENTS.
 *
 * CONNECTION is inherited and is not written here: it is IMPORTED, function for function, from
 * the code I-08B3.1-D1 shipped. PATTERN and INSIGHT are authored here, on the same falloff law,
 * the same lifecycle envelope and the same easing vocabulary.
 *
 * WHAT MAKES THEM THREE THINGS RATHER THAN ONE THING WITH THREE COSTUMES is the TOPOLOGY of the
 * light — where it is, how many sources there are, and which way they travel:
 *
 *   CONNECTION  ONE source, TRAVELLING along a route from A to B.        direction
 *   PATTERN     MANY sources, CONTRACTING toward a shared locus.         convergence
 *   INSIGHT     MANY sources, CONTRACTING onto ONE EMPTY POINT.          emergence
 */

import {
  T, phase, EASE, envelope, meaningEnvelope, LIFECYCLE,
} from './d2-foundation.mjs';
import { TOPICS, topicById } from './d2-world.mjs';

/**
 * PATTERN and INSIGHT run the shared lifecycle at 1.25x, and CONNECTION runs it at 1.0x.
 *
 * Material 3's motion system ships three speeds of the same spring and says which is which:
 * "Most motion should use the default speed, while smaller elements may use fast and larger
 * elements may use slow." CONNECTION is one travelling point between two words; PATTERN and
 * INSIGHT span much of the map with several simultaneous sources. The SHAPE is untouched — same
 * asymmetric envelope, same two curves, same exact zero at the end.
 */
export const LIFECYCLE_SCALE = 1.25;

/* ===================================================================== state ========== */
export const ZERO = Object.freeze({
  /* selection — neutral, on the frozen reading ramp, never warm */
  memberLift: 0,
  /* light */
  sourceLevel: 0,
  /* PATTERN residue */
  locusReveal: 0, linkDraw: 0, linkLevel: 0, markReveal: 0,
  /* INSIGHT residue */
  nodeReveal: 0, nodeBlur: 0, keelDraw: 0,
  /* the field's brief acknowledgement — the one channel that touches AMBIENT */
  fieldRecede: 0,
});

export const RESIDUE_KEYS = ['locusReveal', 'linkDraw', 'linkLevel', 'markReveal', 'nodeReveal', 'keelDraw'];
export const TRANSIENT_KEYS = ['memberLift', 'sourceLevel', 'nodeBlur', 'fieldRecede'];

/* ===================================================================== PATTERN ======== */
/**
 * PATTERN CRYSTALLIZATION — «تبلوُر النمط».
 *
 * ==========================================================================================
 * WHAT CHANGED IN D2R, AND WHY IT WAS A BLOCKER
 * ==========================================================================================
 *
 * I-08B3.1-D2 computed the PRINCIPAL AXIS of the four member positions, drew a spine along it,
 * and tied each member to that spine at its perpendicular distance — presenting the residuals as
 * the system being candid about the quality of its fit.
 *
 * It was worse than a flourish, and the fact that it looked like rigour is why. **QANDEEL does
 * not know a Pattern because four renderer coordinates happen to line up.** It knows a Pattern
 * because the analysis identified a member set and a larger analytical structure. Screen
 * positions are a LAYOUT, and a layout has no analytical authority — so an axis fitted to them
 * is a statistic about the drawing, dressed as a statement about the user's life. D2 then drew
 * "how well each member fits" from that statistic, which is an invented quantity presented as an
 * honest one.
 *
 * The self-congratulation made it harder to see: "the pattern is incapable of looking tidier
 * than it is" was true of the FIT and meaningless about the PATTERN.
 *
 * ==========================================================================================
 * WHAT D2R DRAWS INSTEAD
 * ==========================================================================================
 *
 * Only what the Product actually knows: **THESE FOUR TOPICS ARE MEMBERS OF ONE NEWLY
 * CRYSTALLIZED PATTERN.** That is a set. A set has no axis, no order, no spacing and no
 * goodness of fit.
 *
 *   - A NEW NEUTRAL ANALYTICAL OBJECT — the pattern's own locus — resolves at an authored,
 *     empty position. Its position is LAYOUT: it is where the object fits on screen, and it
 *     means nothing. Nothing about it is derived from where the members are.
 *   - ONE MEMBERSHIP LINK per member, joining each member to the locus. Every link is IDENTICAL
 *     in every property that could encode anything — width, opacity, colour, dash — and they all
 *     draw SIMULTANEOUSLY, because a stagger is an order and there is no order.
 *   - ONE IDENTICAL MEMBERSHIP MARK at each member, so membership is legible AT the member and
 *     does not depend on reading a line whose length is an accident of layout.
 *
 * Link length varies because positions vary. That is unavoidable and it is declared: length is a
 * consequence of the map, not a quantity. Guard S3 asserts every link is identical in every
 * property that is actually written, at every frame, which is the part that can be enforced.
 */
export const PATTERN_MEMBERS = ['mastery', 'sleep', 'fear-shortfall', 'energy-decline'];

/**
 * THE LOCUS IS AUTHORED, NOT COMPUTED, and that is the difference between layout and inference.
 *
 * D2 put the pattern object at the centroid of the members, which reads as innocent and is not:
 * a centroid is a statistic of the member positions, so the object's position would have been
 * derived from geometry and a reader could take its placement as meaning something. This is a
 * clear spot on the map, chosen because the drawing fits there.
 */
export const PATTERN_LOCUS = { x: 240, y: 470 };
export const PATTERN_LABEL = 'نمط';
export const PATTERN_SUBLABEL = 'من أربعة مواضيع';

export function patternGeometry() {
  const members = PATTERN_MEMBERS.map(topicById);
  return {
    members,
    locus: PATTERN_LOCUS,
    /**
     * One link per member, ATTACHED AT THE CONTOUR EDGE rather than at the centre.
     *
     * Attachment geometry, not meaning: a link that runs to the centre crosses the topic's own
     * label on the way — the first rendered frame had four lines through four names — and its
     * membership mark lands on top of the text. Meeting the ring where it faces the locus keeps
     * every name readable and puts the mark somewhere a reader can see it.
     *
     * No ordering is implied by the array. They are rendered together.
     */
    links: members.map((m) => {
      const dx = PATTERN_LOCUS.x - m.x, dy = PATTERN_LOCUS.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const edge = { x: m.x + (dx / d) * m.radius, y: m.y + (dy / d) * m.radius };
      return { id: m.id, from: { x: PATTERN_LOCUS.x, y: PATTERN_LOCUS.y }, to: edge };
    }),
  };
}

const GEOM = patternGeometry();
export const PATTERN_GEOMETRY = GEOM;

/**
 * How far a converging light travels toward the locus. WELL UNDER 1, and that is load-bearing:
 * four lobes arriving at one coordinate stack their gradients and produce a bright disc, which
 * is an ORB — forbidden by name — and it arrives without anyone choosing it. Convergence is a
 * DIRECTION, not a destination.
 */
export const MERGE_FRACTION = 0.34;

function patternSources(converge, level) {
  if (level <= 0) return [];
  const k = Math.max(0, Math.min(1, converge));
  return GEOM.members.map((m) => {
    const target = {
      x: m.x + (PATTERN_LOCUS.x - m.x) * MERGE_FRACTION,
      y: m.y + (PATTERN_LOCUS.y - m.y) * MERGE_FRACTION,
    };
    /**
     * Each lobe begins spread across ITS OWN TOPIC — a radius covering the ring — and contracts
     * as it moves toward the locus. That contraction is the movement the eye actually reads, and
     * it is a true one: a pattern is made of the material inside those topics.
     */
    const startR = 1.35 * m.radius;
    return {
      x: m.x + (target.x - m.x) * EASE.considered(k),
      y: m.y + (target.y - m.y) * EASE.considered(k),
      r: startR + (30 - startR) * EASE.considered(k),
      /**
       * IDENTICAL FOR EVERY MEMBER at every frame — a per-member amplitude would be a strength,
       * and a set has no strengths. Check C5 measures that across all frames.
       *
       * The small decline with `k` keeps four closing lights from adding up to more light than
       * the event began with. It was steeper until R8 measured the consequence: at 0.84 the
       * pattern's light reached only ONE pixel above the instrument's floor, which is a
       * measurement standing on the edge of its own blindness.
       */
      level: level * (0.98 - 0.06 * k),
      angle: 0,
      elong: 0,
    };
  });
}

export function patternEvent(t) {
  const S = { ...ZERO, sources: [] };
  if (t <= T.EVENT_START) return S;

  /* 1. RECOGNITION. The four members resolve on the NEUTRAL ramp — identically. This beat says
        WHICH things, and saying which thing is not a light event. */
  S.memberLift = envelope(t, T.EVENT_START, 300, 1600);

  /* 2. CONVERGENCE. Four lights contract toward the locus and stop short of it. */
  const level = meaningEnvelope(t, T.EVENT_START + 90, LIFECYCLE_SCALE);
  const converge = EASE.considered(phase(t, T.EVENT_START + 90, T.EVENT_START + 1100));
  S.sourceLevel = level;
  S.sources = patternSources(converge, level);

  /* 3. CRYSTALLIZATION. The new analytical object resolves, then every membership link draws —
        all of them at once, outward from the locus. Crystallization begins while the light is
        still up: convergence and crystallization are one thing seen twice. */
  S.locusReveal = EASE.emerge(phase(t, T.EVENT_START + 420, T.EVENT_START + 1100));
  S.linkDraw = EASE.emerge(phase(t, T.EVENT_START + 620, T.EVENT_START + 1420));
  S.linkLevel = EASE.emerge(phase(t, T.EVENT_START + 600, T.EVENT_START + 900));
  S.markReveal = EASE.emerge(phase(t, T.EVENT_START + 980, T.EVENT_START + 1620));

  S.fieldRecede = 0.30 * envelope(t, T.EVENT_START + 120, 420, 1300);

  if (t >= T.SETTLE_END) return { ...ZERO, sources: [], locusReveal: 1, linkDraw: 1, linkLevel: 1, markReveal: 1 };
  return S;
}

/* ===================================================================== INSIGHT ======== */
/**
 * INSIGHT EMERGENCE — «انبثاق فهم جديد». Unchanged from I-08B3.1-D2; review accepted it.
 *
 * THE ONE RULE THAT SEPARATES THIS FROM A SPARKLE IS THAT THE LIGHT TRAVELS INWARD. Every
 * forbidden effect in this space — sparkle, starburst, particle explosion, bloom — shares one
 * property: light appears at a point and moves AWAY from it, which reads as an emission.
 * Emergence is the opposite motion, and it is measured rather than asserted.
 */
export const INSIGHT_SITE = { x: 248, y: 548 };
export const INSIGHT_TEXT = 'الإتقان يسبق السهر بيومين';
export const INSIGHT_LABEL = 'فهم جديد';
export const INSIGHT_SIZE = 18;
export const INSIGHT_KEEL = { dy: 36, halfWidth: 48 };
export const INSIGHT_LOBES = 5;
export const INSIGHT_GATHER_RADIUS = 132;
/**
 * A gather closes to a RING, never to a point — same reason as MERGE_FRACTION. Five lobes
 * contracting onto one coordinate stack into a bright disc with the conclusion sitting inside
 * it, which is an orb with a caption.
 */
export const INSIGHT_RESIDUAL_RADIUS = 21;

function insightSources(contract, level) {
  if (level <= 0) return [];
  const k = Math.max(0, Math.min(1, contract));
  const R = INSIGHT_RESIDUAL_RADIUS + (INSIGHT_GATHER_RADIUS - INSIGHT_RESIDUAL_RADIUS) * (1 - k);
  const out = [];
  for (let i = 0; i < INSIGHT_LOBES; i++) {
    const th = (i / INSIGHT_LOBES) * Math.PI * 2 + 0.42;
    out.push({
      x: INSIGHT_SITE.x + R * Math.cos(th),
      y: INSIGHT_SITE.y + R * Math.sin(th) * 0.74,
      r: 44 - 16 * k,
      level: level * (1.0 - 0.18 * k),
      angle: (th * 180) / Math.PI,
      elong: 0.55 * (1 - k),
    });
  }
  return out;
}

export function insightEvent(t) {
  const S = { ...ZERO, sources: [] };
  if (t <= T.EVENT_START) return S;

  const level = meaningEnvelope(t, T.EVENT_START, LIFECYCLE_SCALE);
  const contract = EASE.considered(phase(t, T.EVENT_START, T.EVENT_START + 900));
  S.sourceLevel = level;
  S.sources = insightSources(contract, level);

  S.nodeReveal = EASE.emerge(phase(t, T.EVENT_START + 430, T.EVENT_START + 1180));
  S.nodeBlur = EASE.swell(phase(t, T.EVENT_START + 430, T.EVENT_START + 1300));
  S.keelDraw = EASE.emerge(phase(t, T.EVENT_START + 900, T.EVENT_START + 1700));

  S.fieldRecede = 0.34 * envelope(t, T.EVENT_START + 60, 380, 1400);

  if (t >= T.SETTLE_END) return { ...ZERO, sources: [], nodeReveal: 1, keelDraw: 1 };
  return S;
}

/* ============================================================ REDUCED MOTION ========== */
/**
 * REAL COUNTERPARTS, NOT A SWITCH. Reanimated's own table is why: with reduced motion on,
 * `withTiming` and `withSpring` "return the toValue immediately" and entering animations "jump
 * to the endpoint", so a global setting does not make an event gentler — it makes it a CUT.
 *
 * KEEP level, ink and draw; DROP travel, contraction, scale and blur. The meaning was never in
 * the travel: what a user has to end up knowing is WHICH things, WHAT structure, and THAT it is
 * settled, and all three are states.
 */
export function patternReduced(t) {
  const S = { ...ZERO, sources: [] };
  if (t <= T.EVENT_START) return S;

  S.memberLift = envelope(t, T.EVENT_START, 340, 1600);
  const level = meaningEnvelope(t, T.EVENT_START + 90, LIFECYCLE_SCALE) * 0.80;
  S.sourceLevel = level;
  /* converge pinned to 0: every lobe stays on its own member for the whole event. */
  S.sources = patternSources(0, level);

  S.locusReveal = EASE.emerge(phase(t, T.EVENT_START + 420, T.EVENT_START + 1100));
  /* The links do not wipe. They are present at FULL LENGTH from the first frame they exist and
     arrive by opacity alone — a wipe is motion across the screen; a fade is not. */
  S.linkDraw = t > T.EVENT_START + 620 ? 1 : 0;
  S.linkLevel = EASE.emerge(phase(t, T.EVENT_START + 620, T.EVENT_START + 1300));
  S.markReveal = EASE.emerge(phase(t, T.EVENT_START + 980, T.EVENT_START + 1620));

  if (t >= T.SETTLE_END) return { ...ZERO, sources: [], locusReveal: 1, linkDraw: 1, linkLevel: 1, markReveal: 1 };
  return S;
}

export function insightReduced(t) {
  const S = { ...ZERO, sources: [] };
  if (t <= T.EVENT_START) return S;

  const level = meaningEnvelope(t, T.EVENT_START, LIFECYCLE_SCALE) * 0.82;
  S.sourceLevel = level;
  /* The same five lobes, at their arrived positions, never moving. One big lobe at the site
     would have been simpler and would have been a disc — and a reduced counterpart is not
     allowed to reach a picture the full-motion one is forbidden from. */
  S.sources = insightSources(1, level);

  S.nodeReveal = EASE.emerge(phase(t, T.EVENT_START + 500, T.EVENT_START + 1400));
  /* DELIBERATELY ZERO. Apple's Reduce Motion guidance asks for avoiding animating into and out
     of blurs, and the node is crossing INTO existence, which is exactly an animated blur. */
  S.nodeBlur = 0;
  S.keelDraw = t > T.EVENT_START + 1180 ? 1 : 0;
  S.keelLevel = EASE.emerge(phase(t, T.EVENT_START + 1180, T.EVENT_START + 1900));

  if (t >= T.SETTLE_END) return { ...ZERO, sources: [], nodeReveal: 1, keelDraw: 1, keelLevel: 1 };
  return S;
}

/* ================================================================== the registry ====== */
export const EVENTS = {
  pattern: { key: 'pattern', name: 'PATTERN CRYSTALLIZATION', arabic: 'تبلوُر النمط', apply: patternEvent, reduced: patternReduced },
  insight: { key: 'insight', name: 'INSIGHT EMERGENCE', arabic: 'انبثاق الفهم', apply: insightEvent, reduced: insightReduced },
};

export const ALL_TOPIC_IDS = TOPICS.map((t) => t.id);
