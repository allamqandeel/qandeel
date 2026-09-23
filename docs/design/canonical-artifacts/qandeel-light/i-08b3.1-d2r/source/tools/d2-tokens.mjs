/**
 * I-08B3.1-D2R — THE PRODUCTION TOKEN FAMILY, AS A FREEZE CANDIDATE.
 *
 * `qandeel.illumination` has been RESERVED AND DELIBERATELY EMPTY since I-08B3.1-C3, with its
 * own description naming this track as its owner. D2 fills it — as a CANDIDATE. Independent
 * review owns the closure decision and this package does not declare anything frozen.
 *
 * ------------------------------------------------------------------------------------------
 * IT EXTENDS THE FROZEN RESOLVER. IT DOES NOT STAND BESIDE IT.
 * ------------------------------------------------------------------------------------------
 *
 * I-08B3.1-C3 set the precedent and the reason: it extended B4R's frozen Surface resolver rather
 * than shipping a sibling token file, "so that the material and the neutrals it is judged
 * against come out of ONE resolution". A sibling is how a system ends up with two answers to the
 * same name, and neither of them wrong on its own. So the resolver emitted here lists C3's sets
 * first, unmodified and by reference, and adds two of its own after them.
 *
 * ------------------------------------------------------------------------------------------
 * TWO GROUPS, NOT ONE, AND THE SPLIT IS THE DOCTRINE.
 * ------------------------------------------------------------------------------------------
 *
 *   qandeel.illumination   MEANING LIGHT. Event-based. Appears when meaning emerges.
 *   qandeel.atmosphere     THE WORLD'S CHARACTER. Persistent. NOT illumination.
 *
 * Putting atmosphere inside the illumination group would have been tidier and would have said
 * the thing the whole system exists to deny — that the world's ambient life is a kind of
 * meaning. They are siblings, and the atmosphere group's own description says what it is not.
 *
 * ------------------------------------------------------------------------------------------
 * WHAT IS DELIBERATELY *NOT* A TOKEN.
 * ------------------------------------------------------------------------------------------
 *
 * The brief is explicit: do not create meaningless tokens for every visual parameter. So the
 * eighteen ring colours are not eighteen tokens — they are DERIVED from three that are (a hue,
 * a plane lightness, one chroma ceiling), and the derivation is stated. Magnitudes that an
 * implementer should tune against a real device — stroke widths, the pool's offset, the node's
 * 3 px rise — stay as implementation craft parameters in d2-render.mjs and are listed in
 * D2R_IMPLEMENTATION_BOUNDARIES.md as exactly that.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './d2-main.mjs';
import { hexToRgb8 } from '../vendor/color.mjs';
import { LIGHT, ATMOSPHERE, LIFECYCLE, FALLOFF, FOUNDATION } from '../scene/d2-foundation.mjs';
import { LIFECYCLE_SCALE, MERGE_FRACTION, INSIGHT_LOBES, INSIGHT_RESIDUAL_RADIUS } from '../scene/d2-events.mjs';
import { MAGNITUDE } from '../scene/d2-render.mjs';
import { PARALLAX, CONTOUR, RINGS } from '../scene/d2-world.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const TOKENS = join(PKG, 'tokens');

/** The DTCG colour object form the frozen C3 tree already uses, so nothing here is a new shape. */
const color = (hex, $description) => ({
  $value: { colorSpace: 'srgb', components: hexToRgb8(hex).map((c) => +(c / 255).toFixed(6)), hex: hex.toLowerCase() },
  $description,
});

const num = ($value, $description) => ({ $type: 'number', $value, $description });
const dim = (value, $description) => ({ $type: 'dimension', $value: { value, unit: 'px' }, $description });
const dur = (value, $description) => ({ $type: 'duration', $value: { value, unit: 'ms' }, $description });

/* =========================================== REV-03: WHAT IS FREEZEABLE AND WHAT IS NOT = */
/**
 * I-08B3.1-D2 CONTAINED A BOUNDARY CONTRADICTION AND THIS RESOLVES IT.
 *
 * Its implementation-boundaries document §3 correctly called values like the 3.4 px source blur,
 * the 0.34 merge fraction and the 21 px residual radius CRAFT PARAMETERS TO TUNE ON A REAL
 * DEVICE — and several of them also sat in the token family, which §2 called freeze candidates
 * wholesale. The same number was therefore both provisional and irreversible.
 *
 * The distinction is not "is it in a token file". A token exists so an implementation is
 * CONSISTENT; freezing exists so a PRODUCT DECISION is irreversible. Those are different jobs
 * and a value can have the first without the second.
 *
 *   product-contract     Changing it changes what the product MEANS. Freezeable.
 *   production-default   A calibrated starting value. Changing it inside its stated bound
 *                        changes how the product FEELS, not what it says. NOT Product-frozen,
 *                        and explicitly expected to move once a device has been seen.
 *
 * Every token carries one of these, and `classify()` throws on any token that carries neither —
 * so a token added later cannot quietly inherit "frozen" by sitting in the file.
 */
export const FREEZE = {
  'qandeel.expression.illumination.core': 'product-contract',
  'qandeel.expression.illumination.mid': 'product-contract',
  'qandeel.expression.illumination.low': 'product-contract',
  'qandeel.illumination.core': 'product-contract',
  'qandeel.illumination.mid': 'product-contract',
  'qandeel.illumination.low': 'product-contract',
  'qandeel.illumination.falloff.exponent': 'production-default',
  'qandeel.illumination.falloff.reach-base': 'production-default',
  'qandeel.illumination.falloff.reach-gain': 'production-default',
  'qandeel.illumination.falloff.ceiling': 'production-default',
  'qandeel.illumination.lifecycle.rise': 'production-default',
  'qandeel.illumination.lifecycle.fall': 'production-default',
  'qandeel.illumination.lifecycle.scale-default': 'production-default',
  'qandeel.illumination.lifecycle.scale-large': 'production-default',
  'qandeel.illumination.lifecycle.easing.settle': 'production-default',
  'qandeel.illumination.intensity.event-peak': 'production-default',
  'qandeel.illumination.extent.source-blur': 'production-default',
  'qandeel.illumination.extent.insight-residual-radius': 'production-default',
  'qandeel.illumination.extent.pattern-merge-fraction': 'production-default',
  'qandeel.illumination.extent.insight-lobes': 'production-default',
  'qandeel.illumination.role.emerge': 'product-contract',
  'qandeel.illumination.role.crystallize': 'product-contract',
  'qandeel.illumination.role.settle': 'product-contract',
  'qandeel.illumination.reduced.travel': 'product-contract',
  'qandeel.illumination.reduced.blur': 'product-contract',
  'qandeel.illumination.reduced.parallax-differential': 'product-contract',
  'qandeel.atmosphere.chroma-ceiling': 'product-contract',
  'qandeel.atmosphere.luminance.near': 'production-default',
  'qandeel.atmosphere.luminance.mid': 'production-default',
  'qandeel.atmosphere.luminance.far': 'production-default',
  'qandeel.atmosphere.hue.h1': 'production-default',
  'qandeel.atmosphere.hue.h2': 'production-default',
  'qandeel.atmosphere.hue.h3': 'production-default',
  'qandeel.atmosphere.hue.h4': 'production-default',
  'qandeel.atmosphere.hue.h5': 'production-default',
  'qandeel.atmosphere.hue.h6': 'production-default',
  'qandeel.atmosphere.contour.harmonics': 'production-default',
  'qandeel.atmosphere.contour.amplitude-total': 'production-default',
  'qandeel.atmosphere.contour.rings-near': 'production-default',
  'qandeel.atmosphere.contour.rings-mid': 'production-default',
  'qandeel.atmosphere.contour.rings-far': 'production-default',
  'qandeel.atmosphere.parallax.near': 'production-default',
  'qandeel.atmosphere.parallax.mid': 'production-default',
  'qandeel.atmosphere.parallax.far': 'production-default',
  'qandeel.atmosphere.parallax.deceleration-rate': 'production-default',
};

/**
 * THE PRODUCT CONTRACT THAT IS NOT A TOKEN, AND MOSTLY IT IS NOT.
 *
 * The important half of what D2R proposes freezing has no value to put in a token file. These
 * are the statements independent review would be freezing; the token classification above only
 * says which NUMBERS are irreversible alongside them.
 */
export const CONTRACT_STATEMENTS = [
  'There are FOUR Light categories: AMBIENT, CONNECTION, PATTERN, INSIGHT. A fifth is a new Product decision.',
  'They are four topologies of one falloff law: FIELD, DIRECTION, CONVERGENCE, EMERGENCE.',
  'AMBIENT is not Meaning Light. ACTIVITY is neither, and has no expression in this system.',
  'Meaning Light is EVENT-BASED: it begins, it decays, and it reaches EXACTLY zero.',
  'The lifecycle is EMERGE -> CRYSTALLIZE -> SETTLE, with crystallization beginning before emergence ends.',
  'No persistent glow, no looping pulse, no residual animation is required to understand any settled state.',
  'Every meaning event ends in a NEUTRAL analytical residue readable with no animation.',
  'Reduced motion is a real alternate expression reaching the SAME settled meaning, never animation switched off.',
  'No animated blur under reduced motion, anywhere, including the inherited Connection.',
  'Light may act ON the identity material; the material is never a source.',
  'No analytical object carries the identity material.',
  'Atmosphere is never the most colourful thing on screen — bounded below both the material and the Light.',
  'GEOMETRY DOES NOT MANUFACTURE MEANING: no ambient visual property encodes an analytical quantity without a canonical contract granting it.',
  'A PATTERN is a MEMBER SET. Nothing about its order, strength or structure is inferred from screen positions.',
  'CONNECTION is the inherited I-08B3.1-D1 expression and is not reinterpreted.',
];

/* ============================================================= the expression layer === */
export function illuminationExpression() {
  return {
    qandeel: {
      $type: 'color',
      expression: {
        illumination: {
          $description: 'QANDEEL LIGHT expression, dark appearance. I-08B3.1-D2R — FREEZE CANDIDATE.',
          core: color(LIGHT.CORE, 'LIGHT CORE. The centre of a light at full strength.'),
          mid: color(LIGHT.MID, 'LIGHT MID. The body of a light.'),
          low: color(LIGHT.LOW, 'LIGHT LOW. The deep end, where the tint survives; the most chromatic stop.'),
          $extensions: {
            'com.qandeel.provenance': {
              authoredAs: { colorSpace: 'oklch', hue: LIGHT.authored.hue, chromaMax: LIGHT.authored.chromaMax },
              rampShapeInheritedFrom: LIGHT.authored.rampShapeInheritedFrom,
              derivation: 'source/tools/d2-lightsearch.mjs — a search, not a choice.',
              requirement: `minimum separation from qandeel.identity.material of ΔEok ${LIGHT.separationRequired}, measured along the WHOLE compositing path over the World and the functional Surface, at every alpha — not at full strength`,
              requirementStatus: 'ENGINEERING HEURISTIC ADOPTED BY I-08B3.1-D2, NOT A PERCEPTUAL LAW. It gave the search a floor that was not taste; it did not freeze a colour. Its justification is comparative: the superseded family measures 0.0118 and I-08B3.1-D1 could not tell that family\'s dim tail from the identity material. ACCEPTANCE REMAINS: this measurement, PLUS visual Product review, PLUS device validation.',
              measuredSeparation: LIGHT.separationFromBrass,
              supersedes: {
                family: 'I-08B3.1-D0 diagnostic family #fef1d6 / #ecdcbc / #dcc8a1',
                separation: LIGHT.diagnosticSeparation,
                why: 'I-08B3.1-D1 measured the diagnostic family passing within ΔEok 0.0163 of Living Brass on sampled rasters, and this package measured 0.0118 on the full analytical path. At that distance LIGHT and MATTER are not separable at low intensity, which is exactly the intensity an arrival decays through, so "BRASS IS MATTER, LIGHT IS MEANING" stops being checkable where it matters most.',
              },
              status: 'FREEZE CANDIDATE — proposed by I-08B3.1-D2, frozen by nobody',
            },
          },
        },
        atmosphere: {
          $description: 'ATMOSPHERE expression, dark appearance. NOT illumination — see the semantic group.',
          /* No colour literals here on purpose: see the derivation note in the semantic layer. */
        },
      },
    },
  };
}

/* ============================================================== the semantic layer ==== */
export function illuminationSemantic() {
  return {
    $description: 'QANDEEL LIGHT and ATMOSPHERE — semantic layer. I-08B3.1-D2. Extends the frozen I-08B3.1-C3 material layer; the two are resolved together and neither is complete alone.',
    qandeel: {
      illumination: {
        $type: 'color',
        $description: 'QANDEEL LIGHT. MEANING LIGHT, and nothing else. It is NOT loading, NOT generic thinking, NOT a selected state, NOT focus, NOT confidence, NOT importance, NOT severity, NOT a success or warning colour, and NOT generic AI decoration. It appears when meaning genuinely emerges or crystallizes, and it is EVENT-BASED: it has a beginning, a decay and an exact zero. ACTIVITY IS PROCESS. LIGHT IS MEANING. BRASS IS MATTER.',
        core: { $value: '{qandeel.expression.illumination.core}', $description: 'The centre of a light.' },
        mid: { $value: '{qandeel.expression.illumination.mid}', $description: 'The body of a light. Also the tone composited onto the identity material when light reaches it.' },
        low: { $value: '{qandeel.expression.illumination.low}', $description: 'The deep end of a light.' },

        falloff: {
          $description: 'HOW LIGHT FALLS OFF IN QANDEEL — one law, shared by all four categories. This is the load-bearing half of the coherence claim: AMBIENT, CONNECTION, PATTERN and INSIGHT differ in WHERE the light is and HOW MANY sources there are, and in nothing else. reach = radius × (base + gain × level); intensity = level × clamp(1 − distance/reach)^exponent × ceiling.',
          exponent: num(FALLOFF.EXPONENT, 'The falloff exponent. Below 1 so a light keeps presence at its edge instead of ending in a hard ring.'),
          'reach-base': num(FALLOFF.REACH_BASE, 'Reach as a multiple of the source radius at zero level.'),
          'reach-gain': num(FALLOFF.REACH_GAIN, 'How much further a light reaches as its level rises.'),
          ceiling: num(FALLOFF.CEILING, 'The maximum share of a surface a light may take. A lit material never becomes the light.'),
        },

        lifecycle: {
          $description: 'EMERGE → CRYSTALLIZE → SETTLE. Asymmetric, deliberately: the rise is the system responding and is the fast half; the fall is the world returning to rest after an answer, and a snappy fall reads as the insight being retracted. The rise curve is SMOOTHSTEP, q²(3−2q), which has no exact cubic-bézier and is therefore stated as a formula rather than approximated by one. The fall curve is the exact bézier below.',
          rise: dur(LIFECYCLE.RISE, 'Time from nothing to full light.'),
          fall: dur(LIFECYCLE.FALL, 'Time from full light to EXACTLY zero. Never a fade-to-almost.'),
          'scale-default': num(1.0, 'The speed a small, local event runs at — one travelling relation between two objects.'),
          'scale-large': num(LIFECYCLE_SCALE, 'The speed a large event runs at — one spanning much of the map, with several simultaneous sources. Material 3\'s motion system ships three speeds of one spring for this reason: "larger elements may use slow".'),
          easing: {
            $type: 'cubicBezier',
            settle: { $value: [0.38, 0, 0.32, 1], $description: 'The fall. Derived in I-08B3.1-D0, unchanged since. Peak slope 2.23 — the house UI curves tear at this timescale and D0 recorded the measurement.' },
          },
          $extensions: {
            'com.qandeel.easing': {
              rise: { name: 'smoothstep', formula: 'q*q*(3-2*q)', note: 'Eased at BOTH ends, peak slope 1.50. NOT a cubic-bézier; do not substitute one.' },
            },
          },
        },

        intensity: {
          $description: 'How much light an event is permitted. Not a ladder and not a scale of importance: every meaning event in QANDEEL is the same KIND of event, and these bound it rather than rank it.',
          'event-peak': num(MAGNITUDE.WASH_OPACITY, 'The opacity of one light source at full level. Measured consequence: no D2 category exceeds the Light of the CONNECTION the Product Owner already accepted — check R8.'),
        },

        extent: {
          $description: 'The size of a light source, in scene px at the 390 × 844 reference viewport.',
          'source-blur': dim(3.4, 'The gaussian applied to a source, so a light has no edge. A light with an edge is a shape.'),
          'insight-residual-radius': dim(INSIGHT_RESIDUAL_RADIUS, 'How close a gathering may close. NEVER zero: five lobes contracting onto one coordinate stack into a bright disc, which is an orb, which is forbidden. A gather closes to a RING around the thing emerging.'),
          'pattern-merge-fraction': num(MERGE_FRACTION, 'How far along the shared axis converging lights travel toward each other. Well under 1, for the same reason: convergence is a DIRECTION, not a destination.'),
          'insight-lobes': num(INSIGHT_LOBES, 'Fixed bearings a gather arrives from. Fixed, not drawn at random.'),
        },

        role: {
          $description: 'THE THREE TRANSITION ROLES, so an implementer names the beat rather than inventing one. EMERGE: light appears where meaning is forming. CRYSTALLIZE: the neutral analytical geometry draws, while the light is still up — they overlap, because convergence and crystallization are one thing seen twice. SETTLE: light decays to exactly zero and a NEUTRAL RESIDUE remains, readable with no animation at all.',
          emerge: num(0, 'Beat 0.'),
          crystallize: num(1, 'Beat 1. Begins BEFORE emerge has finished.'),
          settle: num(2, 'Beat 2. Ends at exactly zero light.'),
        },

        reduced: {
          $description: 'REDUCED MOTION IS A DIFFERENT EXPRESSION, NOT A DISABLED ONE. Reanimated\'s own behaviour is why: with the setting on, withTiming and withSpring "return the toValue immediately" and entering animations "jump to the endpoint", so a global flag does not make an event gentler — it deletes it. These three say what to remove; everything not listed here is KEPT, including the light rising and falling in place, the ink resolving, and the structure appearing.',
          travel: num(0, 'Lights do not travel. They appear at their arrived positions and stay there.'),
          blur: num(0, 'No animated blur, anywhere. Apple\'s Reduce Motion guidance asks for "avoiding animating into and out of blurs" — a focal change is part of what the setting exists to remove. THIS CORRECTS THE I-08B3.1-D1 REDUCED-MOTION COUNTERPART, which kept a bridging blur.'),
          'parallax-differential': num(0, 'Depth planes move together, so there is no relative motion. APPARENT depth is still carried by scale, luminance and contour count, which are static — and carries no analytical meaning with or without the differential.'),
        },
      },

      atmosphere: {
        $type: 'color',
        $description: 'THE WORLD\'S CHARACTER, AND EXPLICITLY NOT ILLUMINATION. Atmosphere is present while nothing is being understood; Meaning Light appears only when something is. This group is a sibling of qandeel.illumination and never an alias into it. THE RULE THAT KEEPS THEM APART IS ARITHMETIC: atmosphere is never the most colourful thing on screen. Every ambient colour is bounded below BOTH the identity material\'s chroma and the Light\'s least chromatic stop, so a ring can never be mistaken for a meaning event — the mistake is unavailable rather than forbidden.',
        'chroma-ceiling': num(ATMOSPHERE.chromaCeiling, `The OKLCh chroma no ambient colour may reach. DERIVED as 0.62 × the Light's least chromatic stop, so it survives the Light being re-chosen. Measured on rasters by check R6.`),
        luminance: {
          $description: 'One OKLCh lightness per depth plane. PRESENTATION ONLY. Depth here is APPARENT VISUAL DEPTH — a spatial cue that gives the still field layering and gives the pan something to reveal. It encodes NOTHING: not recency, not temporal distance, not amount, not importance, not rank. See ring.layer in PRESENTATION_CONTRACT, which build gate 6 reads.',
          near: num(ATMOSPHERE.L.near, 'The nearest plane. Lightest, because it is nearest — and for no other reason.'),
          mid: num(ATMOSPHERE.L.mid, ''),
          far: num(ATMOSPHERE.L.far, 'The furthest plane. Darkest, because it is furthest — and for no other reason.'),
        },
        hue: {
          $description: 'SIX HUES, CLOSED, ALL OUTSIDE THE WARM BAND. PRESENTATION ONLY: a hue is assigned for composition and encodes nothing — not category, not identity, not type, not state. Every ring on a plane carries the same chroma and the same lightness, so nothing about the palette is ordinal and no ring can look more important than another. Six hues cannot give every topic a unique one, and they are not asked to: THE IDENTITY CHANNEL IN THIS PROOF IS THE TOPIC NAME, which is rendered for every topic in every world. Apple\'s guidance is explicit that colour must never be the only carrier, and here it carries nothing on its own.',
          ...Object.fromEntries(ATMOSPHERE.hues.map((h, i) => [`h${i + 1}`, num(h, `OKLCh hue ${h}°.`)])),
        },
        contour: {
          $description: 'CONTROLLED IRREGULARITY, AUTHORED AND BOUNDED. PRESENTATION ONLY. A topic is drawn as a set of level sets whose radius is modulated by three harmonics with phases derived from an AUTHORED PRESENTATION SEED belonging to the scene — deliberately NOT from the topic\'s analytical identity. It is not an RNG aesthetic: the seed is fixed, so the composition is reproducible inside this proof. It is also NOT a signature: it carries no guarantee of stability across releases, devices or users, and a later release may reseed the whole field and lose nothing. Contour morphology does not identify a topic; the TOPIC NAME does.',
          harmonics: num(CONTOUR.harmonics.length, 'Three, starting at k=2. A first harmonic is a translation, not a shape, and would move a ring off a real map position.'),
          'amplitude-total': num(CONTOUR.amplitudeTotal, 'The harmonics sum to at most this fraction of the radius. Bounded so shape reads as character; above roughly twice this it starts to look like a measurement of something, which would be a lie.'),
          'rings-near': num(RINGS[0].length, 'Level sets drawn on the near plane.'),
          'rings-mid': num(RINGS[1].length, ''),
          'rings-far': num(RINGS[2].length, ''),
        },
        parallax: {
          $description: 'THE ONLY MOTION AMBIENT HAS, AND IT IS THE USER\'S HAND. The field does not move on its own — see D2R_AMBIENT_MEANING_ACTIVITY.md for the four independent reasons. These are the rates each depth plane tracks the gesture at. Under reduced motion every plane uses the NEAR rate.',
          near: num(PARALLAX[0], '1:1 with the finger.'),
          mid: num(PARALLAX[1], ''),
          far: num(PARALLAX[2], ''),
          'deceleration-rate': num(0.998, 'The momentum projection constant, from Apple\'s Designing Fluid Interfaces sample: project(v) = (v/1000)·d/(1−d). The glide after release is the second half of ONE GESTURE, not an animation of the map, which is why it is a projection and not a curve.'),
        },
      },
    },
  };
}

/* ==================================================================== the resolver ==== */
export function resolver() {
  return {
    $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
    version: '2025.10',
    name: 'QANDEEL Light, over the frozen Living Brass and Surface systems',
    description: 'I-08B3.1-D2R — FREEZE CANDIDATE. Extends the frozen I-08B3.1-C3 resolver with QANDEEL LIGHT and ATMOSPHERE rather than standing beside it, so that the Light and the material it must stay separable from come out of ONE resolution. Nothing here is frozen: independent Product and Design review owns that decision.',
    sets: {
      'living-brass': {
        description: 'INHERITED, BYTE-IDENTICAL, FROZEN in I-08B3.1-C3 — which itself inherits I-08B3.1-B4R. D2 does not modify it and does not re-author it.',
        sources: [{ $ref: '../source/vendor/c3/tokens/qandeel-living-brass.resolver.json' }],
      },
      'illumination-semantic': {
        description: 'AUTHORED BY D2. QANDEEL LIGHT and ATMOSPHERE, as roles.',
        sources: [{ $ref: './base/illumination.tokens.json' }],
      },
    },
    modifiers: {
      appearance: {
        description: 'System light/dark appearance. Dark is the canonical expression and the only one with values; light is owned by later work and resolving into it fails loudly rather than returning a colour nobody designed.',
        default: 'dark',
        contexts: {
          dark: [{ $ref: './appearance/dark.illumination.tokens.json' }],
          light: [],
        },
      },
    },
    resolutionOrder: [
      { $ref: '#/sets/living-brass' },
      { $ref: '#/sets/illumination-semantic' },
      { $ref: '#/modifiers/appearance' },
    ],
  };
}

/* ======================================================================= the gates ==== */
/**
 * A TOKEN FILE THAT IS NEVER RESOLVED IS A DOCUMENT, NOT A SYSTEM. Everything emitted above is
 * read back, flattened, and checked — and the checks are the ones the C-track invariants named.
 */
export function gate(semantic, expression) {
  const flat = new Map();
  const walk = (node, path) => {
    if (node && typeof node === 'object' && '$value' in node) { flat.set(path.join('.'), node.$value); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
    }
  };
  walk(semantic.qandeel, ['qandeel']);
  walk(expression.qandeel, ['qandeel']);

  const resolve = (name, seen = []) => {
    if (seen.includes(name)) throw new Error(`d2-tokens: alias cycle at ${name}`);
    if (!flat.has(name)) throw new Error(`d2-tokens: no such token ${name}`);
    const v = flat.get(name);
    const m = typeof v === 'string' && v.match(/^\{([^}]+)\}$/);
    return m ? resolve(m[1].trim(), [...seen, name]) : { value: v, chain: [...seen, name] };
  };

  const failures = [];

  /* Every Light colour resolves to the hex the scene painted with, through an alias chain. */
  for (const [role, hex] of [['core', LIGHT.CORE], ['mid', LIGHT.MID], ['low', LIGHT.LOW]]) {
    const r = resolve(`qandeel.illumination.${role}`);
    if (r.value.hex.toLowerCase() !== hex.toLowerCase()) failures.push(`illumination.${role} resolves to ${r.value.hex}, the scene painted ${hex}`);
    if (r.chain.length < 2) failures.push(`illumination.${role} resolved with no alias chain — a value that is right by coincidence is a copy`);
  }

  /* C3 invariant I-04, applied to the new namespace: NOTHING may alias the identity material. */
  const json = JSON.stringify(semantic);
  if (/\{qandeel\.identity\./.test(json)) failures.push('a member of the new namespaces aliases the identity material — BRASS IS MATTER');
  if (/qandeel\.expression\.material/.test(json)) failures.push('a member reaches the material expression layer directly');

  /* C3 invariant I-18: the name `accent` is forbidden anywhere in the token system. */
  if (/"accent"|\baccent\b/i.test(json)) failures.push('the forbidden name `accent` appears in the token tree');

  /* The doctrine, as a name check: atmosphere must not live inside illumination. */
  if (semantic.qandeel.illumination.atmosphere) failures.push('atmosphere is nested inside illumination — that says the world\'s ambient life is a kind of meaning');

  /* The arithmetic that keeps them apart. */
  const ceiling = resolve('qandeel.atmosphere.chroma-ceiling').value;
  if (!(ceiling < ATMOSPHERE.chromaCeiling + 1e-9)) failures.push('the atmosphere ceiling token disagrees with the scene');

  if (failures.length) throw new Error('d2-tokens: the emitted tree does not resolve —\n  - ' + failures.join('\n  - '));
  return { tokens: flat.size, resolvedLight: ['core', 'mid', 'low'].map((r) => resolve(`qandeel.illumination.${r}`)) };
}

/**
 * Stamp every token with its freeze class, and REFUSE if one is unclassified.
 *
 * The refusal is the point. A token added later must be classified deliberately; it cannot
 * inherit "frozen" by sitting in a file that someone once called a freeze candidate, which is
 * exactly how I-08B3.1-D2's boundary contradiction happened.
 */
export function classify(semantic) {
  const missing = [];
  const counts = { 'product-contract': 0, 'production-default': 0 };
  const walk = (node, path) => {
    if (node && typeof node === 'object' && '$value' in node) {
      const key = path.join('.');
      const cls = FREEZE[key];
      if (!cls) { missing.push(key); return; }
      counts[cls]++;
      node.$extensions = {
        ...(node.$extensions || {}),
        'com.qandeel.freeze': {
          class: cls,
          meaning: cls === 'product-contract'
            ? 'Changing this changes what the product MEANS. Freezeable — subject to independent review.'
            : 'A calibrated production default. Changing it within its stated bound changes how the product FEELS, not what it says. NOT Product-frozen, and expected to move once a real device has been seen.',
        },
      };
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
    }
  };
  walk(semantic.qandeel, ['qandeel']);
  if (missing.length) {
    throw new Error('d2-tokens: these tokens carry no freeze classification, so they cannot be shipped —\n  - ' + missing.join('\n  - '));
  }
  return counts;
}

export function emit() {
  mkdirSync(join(TOKENS, 'base'), { recursive: true });
  mkdirSync(join(TOKENS, 'appearance'), { recursive: true });
  const semantic = illuminationSemantic();
  const expression = illuminationExpression();
  const res = resolver();
  const report = gate(semantic, expression);
  /* Both layers, so the values and the names that alias them carry the same class. */
  const a = classify(semantic), b = classify(expression);
  report.freeze = {
    'product-contract': a['product-contract'] + b['product-contract'],
    'production-default': a['production-default'] + b['production-default'],
  };
  report.contractStatements = CONTRACT_STATEMENTS.length;
  semantic.$extensions = {
    'com.qandeel.freeze-boundary': {
      note: 'A token exists so an implementation is CONSISTENT. Freezing exists so a PRODUCT DECISION is irreversible. They are different jobs, and a value can have the first without the second. Every token below carries com.qandeel.freeze saying which it has.',
      productContract: CONTRACT_STATEMENTS,
    },
  };
  writeFileSync(join(TOKENS, 'base', 'illumination.tokens.json'), JSON.stringify(semantic, null, 2) + '\n');
  writeFileSync(join(TOKENS, 'appearance', 'dark.illumination.tokens.json'), JSON.stringify(expression, null, 2) + '\n');
  writeFileSync(join(TOKENS, 'qandeel-light.resolver.json'), JSON.stringify(res, null, 2) + '\n');
  return report;
}

if (isMain(import.meta.url)) {
  console.log('D2 TOKENS — FREEZE CANDIDATE');
  const r = emit();
  console.log(`  ${r.tokens} tokens emitted and resolved`);
  console.log(`  freeze boundary: ${r.freeze['product-contract']} product-contract, ${r.freeze['production-default']} production-default (tunable), 0 unclassified`);
  console.log(`  ${r.contractStatements} Product-contract statements that are NOT tokens`);
  for (const c of r.resolvedLight) console.log(`    ${c.chain.join(' -> ')}  =  ${c.value.hex}`);
  console.log('  invariants: nothing aliases the identity material; `accent` absent; atmosphere is a sibling of illumination');
  console.log('  wrote tokens/qandeel-light.resolver.json, tokens/base/illumination.tokens.json, tokens/appearance/dark.illumination.tokens.json');
}
