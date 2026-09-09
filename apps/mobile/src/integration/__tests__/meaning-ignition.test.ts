/**
 * T-12 — A76…A84: `QAN-BL-MOT-01`, the Meaning Ignition disposition.
 *
 * ## The v1 answer: NO MEANING IGNITION CUE SHIPS
 *
 * T-10 deferred the M5 cue because no authoritative Product signal distinguished a true committed
 * semantic crystallization from a fetch completing, a projection being replaced, a remount, or
 * navigation — and inventing one would make motion the authority for a Product claim. The absence
 * was recorded as structural: the motion owner could not observe a live advance, a Live Focus
 * transition or a fetch at all.
 *
 * T-12 changed the observability half. The integration owner CAN see both live channels now, so the
 * question had to be asked again rather than inherited. It was, and the answer is the same — for a
 * better reason than before, and one that is checkable rather than argued.
 *
 * **The live channels carry no analysis, by their own frozen wire contract.** `temporal.d.ts` says it
 * in as many words: Reading, Evidence, Memory, Question, Confidence, `K(TC)`/`V` and committed text
 * are "deliberately absent", and so is "analysis". A committed-CU event is `{sessionId, batchId,
 * sourceTurnId, firstSp, lastSp, unitCount}` — conversational bookkeeping, saying that the
 * conversation advanced and nothing whatever about meaning. A Live Focus transition carries the
 * closed reference identity and explicitly no analytical content. Neither is evidence that anything
 * crystallized.
 *
 * **And the projection cannot supply one either.** A disclosure describes the world AS AT a `TC`. The
 * difference between two disclosures is a function of which `TC`s were asked for, which is the
 * reader navigating — and "a projection being replaced" is on T-10's exclusion list by name.
 *
 * So there is no authoritative signal, no cue ships, and this file proves the runtime contains no
 * path that could quietly become one.
 */
import { CONVERSATIONAL_UNITS_COMMITTED, LIVE_FOCUS_TRANSITION } from '../../temporal';
import { createIntegrationRuntime } from '../runtime/integration-runtime';
import { createSpatialCauseBinding } from '../motion/spatial-cause';
import { createProjectionCoordinator } from '../projection/projection-coordinator';
import { createInspectionJourneyCoordinator } from '../journey/inspection-journey';
import { committedEvent, liveFocusEvent } from '../__fixtures__/integration';

/** Every module of the integration layer, as source, for the census below. */
const layer = [
  createIntegrationRuntime,
  createSpatialCauseBinding,
  createProjectionCoordinator,
  createInspectionJourneyCoordinator,
]
  .map((fn) => fn.toString())
  .join('\n');

describe('T12-A76…A84 — no cue ships, and no path could become one', () => {
  it('T12-A82 — the v1 disposition is that no Meaning Ignition cue exists at all', () => {
    // The ONE presentation cause this layer can produce is the composite spatial one. If a second
    // ever appears here it is a new Product claim and must be argued in the open, not discovered.
    expect(layer).toContain('GO_LIVE_AND_LOCATE');
    for (const invented of ['MEANING_IGNITION', 'MeaningIgnition', 'ignite', 'crystalliz', 'meaningIgnition']) {
      expect(layer.includes(invented)).toBe(false);
    }
  });

  it('T12-A76, T12-A77, T12-A78, T12-A79, T12-A80, T12-A81 — no excluded event is wired to any cue', () => {
    // Every one of T-10's exclusions, checked as a census over the layer that would have to do the
    // wiring. A cue attached to a mount, a fetch, a remount, a viewport, a Return or a projection
    // replacement cannot exist here because nothing here produces a cue from any of them.
    for (const excluded of ['onMount', 'didMount', 'onFetch', 'onLoad', 'inViewport', 'onVisible', 'firstSeen', 'onRemount']) {
      expect(layer.includes(excluded)).toBe(false);
    }
  });

  it('the live channels carry no analytical content that a cue could honestly be derived from', () => {
    // Read off the real wire events rather than the documentation about them. A committed CU says
    // the conversation advanced; there is no Reading, Evidence, Question, Confidence, analysis or
    // committed text anywhere in it to say that meaning formed.
    const committed = committedEvent(1, 2);
    expect(Object.keys(committed).sort()).toEqual([
      'batchId',
      'firstSp',
      'lastSp',
      'sessionId',
      'sourceTurnId',
      'type',
      'unitCount',
      'version',
    ]);
    expect(committed.type).toBe(CONVERSATIONAL_UNITS_COMMITTED);

    const focus = liveFocusEvent(3);
    expect(Object.keys(focus).sort()).toEqual(['atSp', 'sessionId', 'type', 'value', 'version']);
    expect(focus.type).toBe(LIVE_FOCUS_TRANSITION);
    // The value is the closed reference identity and carries no analytical content.
    expect(Object.keys(focus.value)).toEqual(['kind']);
  });

  it('T12-A84 — nothing in the layer schedules, delays or replays a presentation cue', () => {
    for (const forbidden of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'Date.now', 'performance.now']) {
      expect(layer.includes(forbidden)).toBe(false);
    }
  });
});
