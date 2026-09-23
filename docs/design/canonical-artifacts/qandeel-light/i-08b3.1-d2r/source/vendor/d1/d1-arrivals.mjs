/**
 * I-08B3.1-D1 — THE THREE ARRIVAL LANGUAGES, and their reduced-motion counterparts.
 *
 * Each is a pure function from a millisecond to a PARTIAL state covering only the nine arrival
 * channels. None of them can touch the Guided Thread, the DOM, an element, a colour or a
 * coordinate: `merge()` throws by name if one tries. Every visible difference a Product Owner
 * sees between the three videos originates in one of these three functions and nowhere else.
 *
 * WHAT ACTUALLY DIFFERS, stated plainly so it can be checked against the code:
 *
 *   A  The event is AT THE DESTINATION. It softens for an instant and resolves, compresses
 *      very slightly and settles, and lifts along the frozen neutral reading ramp toward
 *      PRIMARY. Warm light falls on the GROUND beneath it and never on its glyphs. The relation
 *      simply writes itself, as it does in every direction.
 *   B  The event is IN THE RELATION. A provisional route — offset from the true one and drawn
 *      broken — appears at contact and CONVERGES onto the canonical curve while the resolved
 *      relation is revealed over it from the destination end. The destination barely reacts.
 *      Nothing about the relation is luminous at any millisecond.
 *   C  All three sites act, ORCHESTRATED: reception at contact, crystallisation 100 ms later,
 *      and 190 ms after that the field itself acknowledges and returns. Each individual site is
 *      QUIETER than in the direction that owns it — 0.80 of A's reception, 0.85 of B's
 *      crystallisation. C is louder in STRUCTURE and never in amplitude.
 *
 * THE FAIRNESS CONSEQUENCE, and it is arithmetic rather than intent: the only warm light any
 * direction adds is `receptionGround`, and C takes 0.80 of A's. So C CANNOT win by being
 * brighter — it is strictly dimmer than A, everywhere, at every millisecond. Guard G5 measures
 * that on the rasters rather than trusting the multiplier.
 */
import { T, EASE, phase, envelope, merge, guidedThread, ZERO_STATE } from './d1-scene.mjs';

const C = T.CONNECT_END;            // 2600 ms — contact. Every arrival begins here.
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * A transient that is zero at both ends of its span, for anything that must happen and then
 * stop having happened. Built from the shared vocabulary's `swell`, not from a fourth curve.
 */
const transient = (t, t0, dur) => (t <= t0 || t >= t0 + dur ? 0 : EASE.swell((t - t0) / dur));

/**
 * The provisional route and its convergence, as ONE pair, because the second is meaningless
 * without the first.
 *
 * `relationConverge` describes how far the UNRESOLVED route has travelled toward the canonical
 * one. Left to run on its own it LATCHES at 1 and stays there for the rest of the clip — and a
 * latched channel is a trace of the arrival surviving into the settled state. Nothing paints
 * from it once the provisional stroke is gone (the renderer takes that element out of the
 * document entirely), so the settled RASTER was never at risk. The STATE was, and the state is
 * where fairness check F3 looks: it requires that no direction leaves any mark of its arrival in
 * any channel of the settled vector, which is a stronger and more useful claim than "the pixels
 * happen to match".
 *
 * So convergence is reported only while there is something to converge.
 */
const provisional = (t, t0, amp) => {
  const level = amp * envelope(t, t0, 160, 740);
  return {
    relationProvisional: level,
    relationConverge: level > 0 ? EASE.considered(phase(t, t0, t0 + 740)) : 0,
  };
};

/* ============================================================ A — MATERIAL RECEPTION == */
/**
 * "الفكرة القديمة استقبلت المعنى." — the old idea received the meaning.
 *
 * THE ARGUMENT. The destination is what changed, so the destination is where the event is. It
 * does not emit; it RESOLVES, and the ground under it is what the light actually falls on.
 *
 * WHY THIS IS NOT THE HALO D0 HANDED FORWARD. D0's arrival was a zero-offset warm
 * `text-shadow` on the glyphs themselves — light coming OUT of the type. Every ingredient here
 * is the opposite of that:
 *
 *   - THE LIFT IS NEUTRAL. The destination's ink moves along the FROZEN READING RAMP, from
 *     SECONDARY toward PRIMARY, and back. It gets brighter without getting warmer, which is
 *     what a surface does when it is lit and what a source never does. No pixel of the
 *     destination's text is chromatic in any frame of any direction — guard G3 measures it.
 *   - THE BLUR IS A BRIDGE, NOT AN EFFECT. The craft guidance's own reason for a transient blur
 *     is that "without blur, you see two distinct objects during a crossfade"; it bridges them
 *     so the eye reads one transformation. The destination is genuinely crossing between two
 *     renderings here, and the blur peaks in the middle of that crossing and is exactly zero at
 *     both ends. Capped so the total never reaches the 1.15 CSS px at which D0 measured the
 *     11.5 px standing label becoming unreadable.
 *   - THE PRESS IS WEIGHT, NOT DECORATION. 1.4 % of compression as it takes its place, released
 *     over a longer span than it was taken. Follow-through, not a bounce: it never overshoots
 *     its scale, only its position, and only by 1.5 px.
 *   - THE WARM LIGHT IS ON THE GROUND. `receptionGround` paints the existing wash gradient
 *     under the destination. Light lands on a surface near the object. The object is not the
 *     lamp.
 */
export function arrivalA(t) {
  if (t <= C) return {};
  return {
    // The system responding: up in 260 ms, released over 1150 ms. Asymmetric on purpose.
    receptionGround: envelope(t, C, 260, 1150),
    receptionLift: envelope(t, C, 300, 1500),
    // Transients. Zero at contact, zero again well before SETTLE ends.
    receptionBlur: transient(t, C, 650),
    receptionPress: transient(t, C, 720),
    // The follow-through begins as the crossing finishes (travel completes at 3338 ms).
    priorSettle: transient(t, 3280, 480),
  };
}

/* ====================================================== B — RELATION CRYSTALLIZATION == */
/**
 * "الرابط نفسه اتبلور." — the link itself crystallised.
 *
 * THE ARGUMENT. If QANDEEL is intelligent, the insight is the RELATION, not a lit node. So the
 * whole event happens in the stroke between the two facts, and the destination is left almost
 * alone.
 *
 * WHAT CRYSTALLISATION MEANS HERE, and why it is not brightness. At contact a PROVISIONAL route
 * appears: it runs between the same two endpoints — the analytical claim is not in doubt — but
 * its interior is displaced and it is drawn BROKEN. Over 740 ms it converges onto the canonical
 * curve and its breaks close, while the resolved relation is revealed over it from the
 * destination end. What resolves is COHERENCE and GEOMETRY. The final stroke is exactly
 * `qandeel.analysis.relation` and is never brighter than that, at any millisecond — the brief
 * forbids a luminous final relation, and D1 removed the channel that could have produced one.
 *
 * THE CANDIDATE THIS MOST RESEMBLES, AND WHY IT SURVIVES THE GATE. The motion craft guidance
 * uses "animated line drawing on the analytics graph" as its canonical REJECTION — "functional
 * data the user is reading; decoration hinders". That is the right call for a chart whose data
 * was already there. It is not this: the relation does not exist before the arrival and does
 * exist after it, so the draw is the bridge across a state change that would otherwise
 * teleport. Purpose, in the guidance's own vocabulary: STATE INDICATION. Recorded in
 * D1_ARRIVAL_TRUTH_AUDIT.md §2 rather than assumed.
 */
export function arrivalB(t) {
  if (t <= C) return {};
  return {
    ...provisional(t, C, 1),
    // The destination acknowledges and no more. Well under half of A's reception, and no press
    // and no settle at all: in this direction the destination is not the thing that happened.
    // 0.45 rather than 0.30 because the pool's magnitude was halved after the first captured
    // frame showed A's reading as a glow; at 0.30 of the new level B's acknowledgement had
    // stopped being visible at all, which is a different direction, not a quieter one.
    receptionGround: 0.45 * envelope(t, C, 260, 1150),
    receptionLift: 0.26 * envelope(t, C, 300, 1500),
    receptionBlur: 0.25 * transient(t, C, 650),
  };
}

/* ==================================================== C — CONTROLLED MEANING EMERGENCE */
/**
 * "دي لحظة إن قنديل فهم." — this is the moment QANDEEL understood.
 *
 * THE ARGUMENT. The most cinematic candidate, and the discipline is that its cinema is entirely
 * in the ORCHESTRATION — the craft vocabulary's word for "deliberately timing multiple
 * animations so they feel like one coordinated motion". Three sites act in a 100/190 ms
 * sequence: the destination receives, the relation crystallises, and then the field itself
 * draws a breath and returns.
 *
 * EVERY AMPLITUDE IS BELOW THE DIRECTION THAT OWNS IT. Reception at 0.80 of A. Crystallisation
 * at 0.85 of B. The field's answer is 0.34 of the recede D0's SPATIAL RECALL used, and it comes
 * back to exactly zero. There is no ingredient here that A or B does not have in a stronger
 * form; what C has is that they happen in an order.
 *
 * THE FREQUENCY COST, RECORDED RATHER THAN HIDDEN. The craft gate's first question is how often
 * a user sees a motion, and a three-site orchestration belongs at the "occasional" tier at
 * worst. If QANDEEL reaches a prior meaning many times in a session, C is the direction that
 * pays for it first. That is a Product decision about how often QANDEEL claims to have
 * understood something — not a motion decision — and it is handed to the Product Owner in
 * D1_ARRIVAL_TRUTH_AUDIT.md §4 rather than settled here.
 */
export function arrivalC(t) {
  if (t <= C) return {};
  const R = C;          // reception — at contact
  const X = C + 100;    // crystallisation — one beat later
  const F = C + 290;    // the field's answer — one beat after that
  return {
    receptionGround: 0.80 * envelope(t, R, 260, 1150),
    receptionLift: 0.80 * envelope(t, R, 300, 1500),
    receptionBlur: 0.80 * transient(t, R, 650),
    receptionPress: 0.80 * transient(t, R, 720),
    priorSettle: 0.75 * transient(t, 3280, 480),
    ...provisional(t, X, 0.85),
    // The world acknowledges. It recedes a third of the way and comes all the way back.
    fieldRecede: 0.34 * transient(t, F, 1100),
    currentOrient: 0.30 * transient(t, F, 1250),
  };
}

/* ================================================================= REDUCED MOTION ===== */
/**
 * THE REDUCED-MOTION THREAD. A real counterpart, not a disabled animation.
 *
 * The rule the craft guidance states twice, once for web and once for React Native, is the same
 * rule: reduced motion means FEWER AND GENTLER, keeping the opacity and colour changes that
 * explain a state change and dropping translation, scale, parallax and overshoot. And the
 * Reanimated reference makes the failure mode concrete — under `ReduceMotion.System` a
 * `withTiming` JUMPS TO ITS TARGET, so a counterpart built by flipping one global switch does
 * not become gentle, it becomes a cut. The arrival would stop existing.
 *
 * So the three things the full version carries by MOVEMENT are re-carried by CHANGE:
 *
 *   THE TRACE TRAVELLING THE ROUTE   ->  removed entirely. Nothing moves along the curve. What
 *                                        the CONNECT phase shows instead is the live statement
 *                                        gathering — a colour change, which is kept.
 *   THE DESTINATION CROSSING PLANES  ->  a CROSSFADE between two STATIC renderings, one at the
 *                                        depth plane and one at the relation plane. No
 *                                        intermediate position is ever occupied, so there is no
 *                                        translation — and the start frame is still the start
 *                                        frame, which the brief requires.
 *   THE RELATION WRITING ITSELF      ->  the WHOLE relation fades in at once. `relationDraw` is
 *                                        pinned at 1 and `relationLevel` carries it. A wipe is
 *                                        motion; a fade is not.
 *
 * The envelope is deliberately the same 7000 ms, so a reviewer can put the two videos side by
 * side at the same timestamps. It is not a claim that a reduced-motion arrival should take as
 * long as the full one.
 */
export function guidedThreadReduced(t) {
  const S = { ...ZERO_STATE };
  S.relationOrigin = 1;
  S.relationDraw = 1;          // fully drawn at all times; visibility is carried by the level
  S.relationLevel = 0;
  // `threadPos` is never written in this counterpart, at any millisecond. That is what makes
  // "nothing travels the route" a property of the code rather than of a duration set to zero.

  if (t <= T.REST_END) return S;

  if (t < C) {
    // The live statement gathers and hands off. The same arithmetic as the full thread, and
    // the only thing the CONNECT phase has left.
    const c = phase(t, T.REST_END, C);
    S.currentLight = c < 0.18
      ? EASE.considered(c / 0.18) * 0.62
      : 0.62 + (0.16 - 0.62) * EASE.considered((c - 0.18) / 0.82);
    return S;
  }

  /* -------- the crossfade, and the relation's fade-in ---------------------------------- */
  const x = EASE.emerge(clamp01((t - C) / 450));
  S.priorTravel = 1;           // the MAIN rendering is at the relation plane from contact on
  S.priorReveal = x;           // …and fades in
  S.priorGhost = 1 - x;        // …while the depth rendering fades out beneath it
  S.currentLight = 0.16 * (1 - EASE.considered(clamp01((t - C) / (T.SETTLE_END - C))));
  S.relationLevel = EASE.emerge(clamp01((t - C - 120) / 620));

  if (t >= T.SETTLE_END) {
    return { ...S, priorReveal: 1, priorGhost: 0, relationLevel: 1, currentLight: 0 };
  }
  return S;
}

/**
 * The three reduced arrivals. Each keeps only the channels that are a change rather than a
 * movement, and each keeps its direction's distinguishing idea intact:
 *
 *   A-RM  the neutral lift and the ground reception survive; the press and the 1.5 px
 *         follow-through are dropped, because both are movement and one of them is overshoot.
 *         The bridging blur is KEPT and is the one ingredient reduced motion strengthens the
 *         case for: in this version the destination really is crossfading between two
 *         renderings, which is the exact situation the blur exists to bridge.
 *   B-RM  the provisional relation still appears and still gives way to the resolved one — but
 *         `relationConverge` stays at 0, so the two are cross-dissolved IN PLACE instead of one
 *         sliding onto the other. Crystallisation as a change of state, not of geometry.
 *   C-RM  both, in the same 100 ms order. The field's answer and the live statement's
 *         orientation are dropped outright, because both are spatial.
 *
 * C-RM IS THEREFORE CLOSER TO "A-RM PLUS B-RM" THAN C IS TO "A PLUS B", and that is worth
 * saying out loud rather than leaving for someone to notice: the third beat is precisely the
 * part reduced motion removes. See D1_REDUCED_MOTION_NOTES.md §3.
 */
export function arrivalAReduced(t) {
  if (t <= C) return {};
  return {
    receptionGround: envelope(t, C, 260, 1150),
    receptionLift: envelope(t, C, 300, 1500),
    receptionBlur: transient(t, C, 650),
  };
}

export function arrivalBReduced(t) {
  if (t <= C) return {};
  return {
    relationProvisional: envelope(t, C, 160, 740),
    relationConverge: 0,
    receptionGround: 0.30 * envelope(t, C, 260, 1150),
    receptionLift: 0.26 * envelope(t, C, 300, 1500),
    receptionBlur: 0.25 * transient(t, C, 650),
  };
}

export function arrivalCReduced(t) {
  if (t <= C) return {};
  const X = C + 100;
  return {
    receptionGround: 0.80 * envelope(t, C, 260, 1150),
    receptionLift: 0.80 * envelope(t, C, 300, 1500),
    receptionBlur: 0.80 * transient(t, C, 650),
    relationProvisional: 0.85 * envelope(t, X, 160, 740),
    relationConverge: 0,
  };
}

/* ======================================================================= the six ====== */
const build = (thread, arrival) => (t) => merge(thread(t), arrival(t));

export const ARRIVALS = {
  A: { key: 'A', name: 'MATERIAL RECEPTION', file: 'D1_A_MATERIAL_RECEPTION',
    ar: 'الاستقبال', apply: build(guidedThread, arrivalA) },
  B: { key: 'B', name: 'RELATION CRYSTALLIZATION', file: 'D1_B_RELATION_CRYSTALLIZATION',
    ar: 'تبلوُر الرابط', apply: build(guidedThread, arrivalB) },
  C: { key: 'C', name: 'CONTROLLED EMERGENCE', file: 'D1_C_CONTROLLED_EMERGENCE',
    ar: 'الانبثاق المضبوط', apply: build(guidedThread, arrivalC) },
};

export const REDUCED = {
  A: { key: 'A', name: 'MATERIAL RECEPTION — REDUCED MOTION', file: 'D1_RM_A_MATERIAL_RECEPTION',
    ar: 'الاستقبال — حركة مخفّفة', apply: build(guidedThreadReduced, arrivalAReduced) },
  B: { key: 'B', name: 'RELATION CRYSTALLIZATION — REDUCED MOTION', file: 'D1_RM_B_RELATION_CRYSTALLIZATION',
    ar: 'تبلوُر الرابط — حركة مخفّفة', apply: build(guidedThreadReduced, arrivalBReduced) },
  C: { key: 'C', name: 'CONTROLLED EMERGENCE — REDUCED MOTION', file: 'D1_RM_C_CONTROLLED_EMERGENCE',
    ar: 'الانبثاق المضبوط — حركة مخفّفة', apply: build(guidedThreadReduced, arrivalCReduced) },
};
