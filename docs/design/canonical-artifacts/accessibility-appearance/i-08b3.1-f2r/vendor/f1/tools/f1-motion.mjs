/**
 * I-08B3.1-F1 — THE MOTION AUDIT, AND WHAT F1 IS AND IS NOT ALLOWED TO DO TO IT.
 *
 * NOT ALLOWED: retune one millisecond of the frozen lifecycle, redesign the global transition
 * system, invent a new motion, or apply a Reduced Motion aesthetic to the default. §6 and §19
 * of the brief are explicit and this file's shape obeys them — every DEFAULT column below is a
 * READ of the frozen value, never a write.
 *
 * ALLOWED, AND REQUIRED: classify every motion the frozen proof system actually contains, say
 * KEEP / REDUCE / REPLACE / REMOVE for each with a reason, and extend the reduced counterpart
 * to the motions no earlier package covered.
 *
 * WHAT IS ALREADY DONE AND IS INHERITED WHOLE. I-08B3.1-D2R designed four real reduced
 * counterparts for the four QANDEEL LIGHT categories, proved that every one reaches the SAME
 * settled residue as its full-motion sibling, and proved that 0 frames of any counterpart
 * contain a moving light. F1 does not redo that, does not re-derive it, and does not quietly
 * take credit for it. The rows below marked `owner: 'D2R'` are inherited; their `reduced`
 * column is D2R's decision and this file cites it.
 *
 * WHAT F1 ADDS. Five rows nobody owned: the interaction plane's PRESS, FOCUS and SELECTED, the
 * GUIDED THREAD inherited from I-08B3.1-D0R, and the CAMERA as a Product capability rather than
 * as an effect. Plus the finding that makes the whole part necessary — that the RUNTIME DEFAULT
 * for reduced motion is the failure mode the brief names.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFECYCLE, ATMOSPHERE } from '../vendor/d2r/scene/d2-foundation.mjs';
import { DECELERATION } from '../vendor/d2r/scene/d2-world.mjs';
import { resolveAll } from './f1-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

/**
 * THE FIVE CATEGORIES §5 OF THE BRIEF ASKS FOR, used as the audit's own axis.
 *   1 semantic · 2 navigation/orientation · 3 ambient · 4 decorative · 5 vestibular-triggering
 * A motion can be more than one. The DISPOSITION follows from the categories, not from taste:
 * a motion that is ONLY category 4 may be REMOVED; a motion in category 1 may never be, and
 * must be REPLACED by a channel that carries the same fact.
 */
export const INVENTORY = [
  {
    id: 'ambient.parallax',
    owner: 'D2R',
    what: 'The three depth planes pan at different rates under the user\'s finger.',
    categories: [2, 3, 5],
    defaultBehaviour: `1:1 tracking, layer rates ${ATMOSPHERE ? '1.00 / 0.72 / 0.48' : ''}`,
    disposition: 'REDUCE',
    keeps: [], // nothing to keep: this row carries no category-1 meaning
    reduced: 'The DIFFERENTIAL goes — every plane pans at the NEAR rate. The PAN STAYS.',
    why: 'The vestibular part of parallax is the RELATIVE motion between planes, not the panning. Removing the pan would remove access to the part of the Map that is off-screen, which is deleting analysis rather than reducing motion. Depth survives on the two channels that are not motion at all: level-line count (3/2/1) and scale.',
    reference: 'Apple, Accessibility: "reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion."',
  },
  {
    id: 'ambient.momentum',
    owner: 'D2R',
    what: 'On release the map continues at the finger\'s velocity and rests where the gesture was going.',
    categories: [2, 5],
    defaultBehaviour: `Apple's projection function, deceleration ${DECELERATION}`,
    disposition: 'REMOVE',
    keeps: [], // nothing to keep: this row carries no category-1 meaning
    reduced: 'The map stops where the finger let go. Not a shortened glide — none.',
    why: 'This is the rule\'s real behaviour rather than an approximation of it: withDecay under reduced motion "returns the current value immediately, taking into account the clamp parameter". Nothing is lost, because the resting position a projection would have chosen was never a fact about the analysis.',
    reference: 'Software Mansion, Reanimated — Accessibility.',
  },
  {
    id: 'light.connection',
    owner: 'D2R',
    what: 'A CONNECTION: a travelling point between two words, a crossfade bridged by blur, with follow-through.',
    categories: [1, 3],
    defaultBehaviour: `rise ${LIFECYCLE.RISE} ms, fall ${LIFECYCLE.FALL} ms, cubic-bezier(.38,0,.32,1) to exactly zero`,
    disposition: 'REPLACE',
    keeps: ["level","ink"], // the surviving channels that carry this motion's meaning
    reduced: 'D1\'s counterpart entire, with ONE channel corrected by D2R: receptionBlur peak 0.7988 -> 0.0000.',
    why: 'A Connection\'s truth is its SOURCE, its DESTINATION and that it happened. None of those is the journey, so travel can go and the relation cannot. The blur correction is Apple\'s list taken literally.',
    reference: 'Apple, Accessibility: "Avoiding animating into and out of blurs."',
  },
  {
    id: 'light.pattern',
    owner: 'D2R',
    what: 'A PATTERN: four contractions toward a locus, the locus resolving, four membership links drawn outward simultaneously, four identical marks.',
    categories: [1],
    defaultBehaviour: `lifecycle scaled 1.25 (large), no stagger`,
    disposition: 'REPLACE',
    keeps: ["level","ink","draw"], // the surviving channels that carry this motion's meaning
    reduced: 'Four lights rise and fall IN PLACE; the locus resolves; the links and marks arrive by opacity AT FULL LENGTH.',
    why: 'The links do not wipe. A wipe is motion across the screen; a fade is not. Membership is a SET, and a set has no order — which is also why the default has no stagger, and why the reduced counterpart must not introduce one to make the arrival read.',
    reference: 'D2R_MOTION_AND_REDUCED_MOTION.md §3.',
  },
  {
    id: 'light.insight',
    owner: 'D2R',
    what: 'An INSIGHT: five lobes gathering inward, a node resolving out of the gathering, a keel drawing beneath it, a 3 px rise that settles.',
    categories: [1],
    defaultBehaviour: `lifecycle scaled 1.25 (large)`,
    disposition: 'REPLACE',
    keeps: ["level","ink","draw"], // the surviving channels that carry this motion's meaning
    reduced: 'Five lights at their ARRIVED positions; the node arrives by opacity, SHARP; the keel draws. The gather, the contraction and the blur are gone entirely.',
    why: 'What a user has to end up knowing is WHICH things, WHAT structure, and THAT it is settled — and all three are states.',
    reference: 'D2R_MOTION_AND_REDUCED_MOTION.md §3.',
  },
  {
    id: 'light.ambientfield',
    owner: 'D2R',
    what: 'The ambient field itself.',
    categories: [3],
    defaultBehaviour: 'STILL. Nothing oscillates, at any frequency.',
    disposition: 'KEEP',
    keeps: [], // nothing to keep: this row carries no category-1 meaning
    reduced: 'Unchanged — there is nothing to reduce.',
    why: 'The stillness is already the decision, and it was made against the specific frequency Apple names: "avoid showing an oscillation that has a frequency of around 0.2 Hz because people can be very sensitive to this frequency." A system with a breathing field would have had to delete it here; this one has nothing to delete.',
    reference: 'Apple, Motion (visionOS section, and the same guidance in the WWDC motion talks).',
  },
  {
    id: 'thread.guided',
    owner: 'F1',
    what: 'The GUIDED THREAD — the motion language the Product Owner selected at I-08B3.1-D0R, in which an answer is led from where it came from to where it lands.',
    categories: [1, 2],
    defaultBehaviour: 'Inherited from I-08B3.1-D0R and NOT retuned here.',
    disposition: 'REPLACE',
    keeps: ["level","ink"], // the surviving channels that carry this motion's meaning
    reduced: 'The thread does not travel. Its ORIGIN and its DESTINATION are both present from the first frame, and the relation between them arrives by LEVEL — the origin dims as the destination rises, over the frozen lifecycle, with no path drawn between them.',
    why: 'THE THREAD\'S MEANING IS CONTINUITY: that this answer came from that material. Continuity is a RELATION between two endpoints, and a relation is a state. Deleting the thread under reduced motion would delete the only channel that says where an answer came from, which is provenance — and §3 of the brief lists provenance among the things an accessibility expression may not remove. Apple\'s own alternative is the one used: "Consider using fades when you need to relocate an object" and "instantaneous directional changes during a quick fade-out".',
    reference: 'Apple, Motion. I-08B3.1-D0R.',
  },
  {
    id: 'interaction.press',
    owner: 'F1',
    what: 'PRESS: the ground responds under the finger, beginning on pointer-down.',
    categories: [1],
    defaultBehaviour: 'A transient ground response at presence 0.10, plus — in any implementation that adds one — a scale.',
    disposition: 'REDUCE',
    keeps: ["level"], // the surviving channels that carry this motion's meaning
    reduced: 'The GROUND RESPONSE STAYS. A press scale, if an implementation has one, GOES.',
    why: 'This is F1\'s addition to a table D2R left implicit, and it splits one behaviour into two channels with different fates. E1 owns PRESSED as a TRANSIENT GROUND RESPONSE — a LEVEL change, which is the channel reduced motion keeps. A scale is a SCALE, and Apple\'s list names scaling. Removing press feedback entirely would be the worst possible reading of the setting: it is the one moment where latency is perceived, and a control that does not acknowledge a finger reads as broken rather than as calm.',
    reference: 'Apple, Human Interface Guidelines / WWDC 2018: respond on pointer-down. I-08B3.1-E1 interaction grammar.',
  },
  {
    id: 'interaction.focus',
    owner: 'F1',
    what: 'FOCUS: a detached perimeter appears around the focused object.',
    categories: [1, 2],
    defaultBehaviour: 'A 2 px perimeter at a 2 px offset, with a 1 px dark companion.',
    disposition: 'KEEP',
    keeps: ["draw"], // the surviving channels that carry this motion's meaning
    reduced: 'Unchanged. The perimeter appears; it does not travel between objects.',
    why: 'THERE IS NOTHING HERE TO REDUCE, AND THAT IS WORTH STATING because the tempting reduction is the wrong one. A focus ring that ANIMATES BETWEEN targets would be travel and would have to go; this one does not animate between targets, it appears where focus is. Removing or delaying its appearance under reduced motion would break SC 2.4.7 for a user who asked about motion and said nothing about keyboards.',
    reference: 'WCAG 2.2 SC 2.4.7 Focus Visible. I-08B3.1-E1.',
  },
  {
    id: 'interaction.selected',
    owner: 'F1',
    what: 'SELECTED: an attached marker and a weight step.',
    categories: [1],
    defaultBehaviour: 'A 2 px marker on the inline-start edge; weight 500 -> 600.',
    disposition: 'KEEP',
    keeps: ["draw"], // the surviving channels that carry this motion's meaning
    reduced: 'Unchanged. Both channels are static properties of the settled state.',
    why: 'Neither channel is motion at all. The row is in the table because an audit that only lists what moves cannot be checked for completeness — a reviewer has to be able to see that SELECTED was looked at and found to have nothing to reduce.',
    reference: 'I-08B3.1-E1R composition model.',
  },
  {
    id: 'camera.semanticzoom',
    owner: 'F1',
    what: 'CAMERA TRAVEL between scales of the Map.',
    categories: [2, 5],
    defaultBehaviour: 'OUT OF SCOPE — the global camera and transition system is not designed yet (§19).',
    disposition: 'CARRY FORWARD',
    keeps: [], // nothing to keep: this row carries no category-1 meaning
    reduced: 'A REQUIREMENT, not a design: whatever the camera becomes, its reduced counterpart must land the user at the same place with the same objects visible, and must not require them to watch the journey to know where they are.',
    why: 'F1 is forbidden from designing the global motion system and is also forbidden from leaving a hole where a vestibular-category motion will later go. Naming the obligation is the only move that is both.',
    reference: '§19 of the brief; WCAG 2.2 SC 2.3.3 Animation from Interactions (AAA).',
  },
];

/**
 * THE RUNTIME FINDING. This is not an opinion about Reanimated; it is its documented behaviour,
 * and it is why the token file carries a scalar called `system-default-is-wrong-here`.
 */
export const RUNTIME_DEFAULT = {
  library: 'react-native-reanimated',
  setting: 'ReduceMotion.System — the DEFAULT for every animation',
  documentedBehaviour: [
    ['withSpring, withTiming', 'return the toValue immediately'],
    ['withDecay', 'returns the current value immediately, taking into account the clamp parameter'],
    ['withDelay', 'starts the next animation immediately'],
    ['withRepeat (infinite, or even and reversed)', 'does not start'],
    ['withSequence', 'only starts children whose reduceMotion is Never'],
    ['entering / keyframe / layout animations', 'jump to the endpoint immediately'],
    ['exiting / shared element transitions', 'ARE OMITTED ENTIRELY'],
  ],
  whyItIsTheFailureMode:
    'Applied globally this does not make a QANDEEL meaning event gentler. It makes it a CUT: the event stops existing rather than becoming quieter. The last row is the worst — an OMITTED EXIT deletes the 1,150 ms settle, which is the beat that carries the result. §25 of the brief lists "Reduce Motion simply means nothing moves where motion carried meaning" as a failure condition, and that is the library default.',
  whatQANDEELMustDoInstead: [
    'Do NOT rely on a global <ReducedMotionConfig mode={ReduceMotion.System} /> and stop there.',
    'Declare the REPLACEMENT animation with reduceMotion: ReduceMotion.Never, so the system setting cannot cut the channel that is carrying the meaning.',
    'Switch the SUPPRESSED channels off from qandeel.accessibility.motion.*, at the value, rather than letting the library switch the whole animation off.',
    'Read the setting from AccessibilityInfo.isReduceMotionEnabled and the reduceMotionChanged event, NOT only from useReducedMotion — the hook reports the setting "when the app started" and does not update at runtime, so a user who changes it mid-session gets the old behaviour until restart.',
  ],
  reference: 'docs.swmansion.com/react-native-reanimated — Accessibility. React Native AccessibilityInfo source, main branch.',
};

export function audit() {
  const r = resolveAll();
  const channels = {
    travel: r.scalar.MOTION_TRAVEL.value,
    blur: r.scalar.MOTION_BLUR.value,
    scale: r.scalar.MOTION_SCALE.value,
    parallaxDifferential: r.scalar.MOTION_PARALLAX_DIFFERENTIAL.value,
    decay: r.scalar.MOTION_DECAY.value,
    level: r.scalar.MOTION_LEVEL.value,
    ink: r.scalar.MOTION_INK.value,
    draw: r.scalar.MOTION_DRAW.value,
  };
  const suppressed = Object.entries(channels).filter(([, v]) => v === 0).map(([k]) => k);
  const surviving = Object.entries(channels).filter(([, v]) => v === 1).map(([k]) => k);

  const byDisposition = {};
  for (const row of INVENTORY) (byDisposition[row.disposition] ??= []).push(row.id);

  /**
   * THE COMPLETENESS CHECK, and it is the one that can fail.
   *
   * IT READS A FIELD, NOT A SENTENCE. The first version of this check pattern-matched the prose
   * in `reduced` for words like "stays" and "arrives", and it failed `light.connection` — whose
   * counterpart is entirely correct and whose sentence simply did not contain the vocabulary.
   * A check that a row passes by being phrased agreeably is not a check. So every semantic row
   * now declares `keeps: [...]` naming the SURVIVING CHANNELS that carry its meaning, and the
   * check asserts three things a sentence cannot fake:
   *
   *   1. no category-1 motion has disposition REMOVE
   *   2. every category-1 motion names at least one channel in `keeps`
   *   3. every channel it names is actually in the surviving set — so a row cannot claim to be
   *      carried by TRAVEL, which is suppressed
   */
  const semanticRemoved = INVENTORY.filter((r2) => r2.categories.includes(1) && r2.disposition === 'REMOVE');
  const semanticWithoutReplacement = INVENTORY.filter((r2) => r2.categories.includes(1) && (!Array.isArray(r2.keeps) || r2.keeps.length === 0));
  const keepsASuppressedChannel = INVENTORY.filter(
    (r2) => Array.isArray(r2.keeps) && r2.keeps.some((k) => !surviving.includes(k)),
  ).map((r2) => ({ id: r2.id, claims: r2.keeps.filter((k) => !surviving.includes(k)) }));

  return {
    generatedBy: 'tools/f1-motion.mjs',
    frozenLifecycleReadNotWritten: { rise: LIFECYCLE.RISE, fall: LIFECYCLE.FALL },
    channels,
    suppressed,
    surviving,
    principle: 'KEEP LEVEL, INK AND DRAW; DROP TRAVEL, CONTRACTION, SCALE AND BLUR. — I-08B3.1-D2R, inherited.',
    inventory: INVENTORY,
    counts: { total: INVENTORY.length, byDisposition, ownedByD2R: INVENTORY.filter((x) => x.owner === 'D2R').length, addedByF1: INVENTORY.filter((x) => x.owner === 'F1').length },
    completeness: {
      semanticMotionsRemoved: semanticRemoved.map((x) => x.id),
      semanticMotionsWithoutANamedReplacement: semanticWithoutReplacement.map((x) => x.id),
      rowsClaimingASuppressedChannel: keepsASuppressedChannel,
      /* the probe: the same predicate fed a row that claims a suppressed channel, so the branch
         is demonstrated on every run rather than only when it fires */
      probe: (() => {
        const bad = { id: 'PROBE', categories: [1], disposition: 'REPLACE', keeps: ['travel'] };
        const caught = bad.keeps.some((k) => !surviving.includes(k));
        return { row: bad, rejected: caught };
      })(),
      pass: semanticRemoved.length === 0 && semanticWithoutReplacement.length === 0 && keepsASuppressedChannel.length === 0,
    },
    runtimeDefault: RUNTIME_DEFAULT,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = audit();
  writeFileSync(join(PKG, 'data/F1_MOTION.json'), JSON.stringify(a, null, 2) + '\n');
  console.log('motions audited:', a.counts.total, '| D2R', a.counts.ownedByD2R, '| F1', a.counts.addedByF1);
  for (const [d, ids] of Object.entries(a.counts.byDisposition)) console.log('  ', d.padEnd(14), ids.join(', '));
  console.log('suppressed channels:', a.suppressed.join(', '));
  console.log('surviving channels :', a.surviving.join(', '));
  console.log('completeness:', a.completeness.pass ? 'PASS — no semantic motion is removed, and every one names its replacement' : 'FAIL ' + JSON.stringify(a.completeness));
  if (!a.completeness.pass) process.exit(1);
}
