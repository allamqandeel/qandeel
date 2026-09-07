/**
 * T-08 — R1-04, R1-05, R1-06: nothing engineering-facing reaches the reader.
 *
 * The original chrome shipped structural placeholder copy: raw family tokens and canonical ids, raw
 * binding ids, raw lineage tokens, raw semantic-depth enum names, and a transport refusal code
 * printed straight into a sentence. T-08 owns the Product chrome — no later task owns repairing debug
 * copy — so this suite is the standing proof that none of it can come back.
 *
 * "User-visible" means what a reader can see or hear: rendered text, accessibility labels and hints.
 * A `testID` and a style key are engineering surface a reader never encounters, and scanning those
 * would make the proof fail on `flexDirection` rather than on anything real.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { SEMANTIC_DEPTHS } from '../../state';
import { CONTEXT_CHOICE_TEST_ID } from '../InspectionOrientation';
import { OrientationChrome } from '../OrientationChrome';
import { contextOrientation } from '../context-orientation';
import { inspectionSentence } from '../product-copy';
import { orientationModel } from '../model';
import type { InspectionRenderState } from '../types';
import { chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, known, projectionFor, readableText, TWO_CONTEXT_WORLD, unknownAtTc, withInspection, world } from '../__fixtures__/chrome';

/** Every identifier and enum token the fixtures put into `V`, none of which may ever be spoken. */
const INTERNALS = [
  'reading-1',
  'thread-a',
  'thread-b',
  'binding-a',
  'binding-b',
  'session-1',
  'READING',
  'THREAD',
  'EMERGING_FOCUS',
  'ANALYTICAL_OBJECT',
  'SOURCE_PROVENANCE',
  'THREAD_READING',
  'WORLD/',
  'HISTORICAL_COVERAGE_UNAVAILABLE',
  'LIVE_HEAD_NOT_ESTABLISHED',
  'PROJECTION_',
  'UNKNOWN_AT_TC',
  'DEPTH_WITHHELD',
  'NOT_FETCHED',
];

const spoken = (view: Awaited<ReturnType<typeof render>>): string => readableText(view.toJSON()).join(' | ');

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

describe('R1-04, R1-05 — no internal identifier, token, enum or code is user-visible', () => {
  it('the fully-populated chrome speaks no identifier, family token, depth enum or refusal code', async () => {
    const store = historicalStore({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 5 });
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1', appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' } });
    const view = await render(
      <OrientationChrome surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />,
    );

    const words = spoken(view);
    // The surface really is populated: the inspection, the route and the chooser are all present.
    expect(words).toContain('You are inspecting a reading.');
    expect(words).toContain('Inside a thread, inside a context.');
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).not.toBeNull();

    for (const internal of INTERNALS) expect(words).not.toContain(internal);
    // And no depth is ever named by its constant.
    for (const depth of SEMANTIC_DEPTHS) expect(words).not.toContain(depth);

    await act(async () => {
      view.unmount();
    });
  });

  it('every inspection state speaks in plain language, including the technical ones', () => {
    const states: readonly InspectionRenderState[] = [
      { kind: 'NO_INSPECTION' },
      { kind: 'RENDERABLE', family: 'READING', id: 'reading-1', versionIntent: null, noncurrent: null, lineage: [], contextRequested: false },
      { kind: 'RENDERABLE', family: 'MATERIAL', id: 'material-9', versionIntent: 2, noncurrent: 'SUPERSEDED', lineage: [], contextRequested: false },
      { kind: 'IDENTITY_UNKNOWN_AT_TC' },
      { kind: 'CONTEXT_UNAVAILABLE_AT_TC', family: 'READING', id: 'reading-1', versionIntent: null, noncurrent: null },
      { kind: 'DEPTH_WITHHELD', family: 'THREAD', id: 'thread-a', requiredDepth: 'SOURCE_PROVENANCE' },
      { kind: 'PROJECTION_NOT_FETCHED' },
      { kind: 'PROJECTION_UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' },
      { kind: 'PROJECTION_STALE', reason: 'TEMPORAL_POSITION_CHANGED' },
      { kind: 'PROJECTION_INCOHERENT' },
      { kind: 'INSPECTION_NOT_RESOLVED' },
      { kind: 'RESOLUTION_MALFORMED' },
    ];
    for (const state of states) {
      const sentence = inspectionSentence(state);
      expect(sentence.length).toBeGreaterThan(0);
      for (const internal of INTERNALS) expect(sentence).not.toContain(internal);
      for (const depth of SEMANTIC_DEPTHS) expect(sentence).not.toContain(depth);
    }
  });

  it('the typed distinctions survive the plain language', () => {
    // Five different facts, five different sentences: technical states may share wording with each
    // other, but none of them may sound like an absence in the world.
    const unknown = inspectionSentence({ kind: 'IDENTITY_UNKNOWN_AT_TC' });
    const withheld = inspectionSentence({ kind: 'DEPTH_WITHHELD', family: 'READING', id: 'r', requiredDepth: 'SOURCE_PROVENANCE' });
    const contextGone = inspectionSentence({ kind: 'CONTEXT_UNAVAILABLE_AT_TC', family: 'READING', id: 'r', versionIntent: null, noncurrent: null });
    const noncurrent = inspectionSentence({ kind: 'RENDERABLE', family: 'READING', id: 'r', versionIntent: 2, noncurrent: 'SUPERSEDED', lineage: [], contextRequested: false });
    const technical = inspectionSentence({ kind: 'PROJECTION_NOT_FETCHED' });

    expect(new Set([unknown, withheld, contextGone, noncurrent, technical]).size).toBe(5);
    for (const forbidden of ['wrong', 'deleted', 'never valid', 'invalid', 'does not exist']) {
      expect(noncurrent.toLowerCase()).not.toContain(forbidden);
    }
    for (const absence of ['does not know', 'unknown', 'not there']) {
      expect(technical.toLowerCase()).not.toContain(absence);
      expect(withheld.toLowerCase()).not.toContain(absence);
    }
  });
});

describe('R1-06 — the chooser fails closed when a reader cannot tell the options apart', () => {
  it('two appearances taken up at the SAME moment produce no chooser at all', () => {
    // `V` discloses no human-readable name for a Thread, so appearances bound at one Moment cannot
    // be distinguished by anything a reader may see. Nothing is invented and no id is exposed.
    const ambiguous = world({
      depth: 'ANALYTICAL_OBJECT',
      tc: 4,
      liveHead: 6,
      threads: [
        { id: 'thread-a', x: '1000000', y: '0' },
        { id: 'thread-b', x: '3000000', y: '0' },
      ],
      appearances: [
        { bindingId: 'binding-a', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 },
        { bindingId: 'binding-b', threadId: 'thread-b', readingId: 'reading-1', boundSp: 2 },
      ],
      readings: [{ id: 'reading-1' }],
    });
    const context = contextAt(withInspection(ambiguous, known()));
    const chrome = contextOrientation({ context, identity: { family: 'READING', id: 'reading-1' }, currentBindingId: null, lineage: [] });

    expect(chrome.choiceAvailable).toBe(false);
    expect(chrome.appearances).toEqual([]);
  });

  it('appearances taken up at DIFFERENT moments are distinguishable, and say so without ids', () => {
    const context = contextAt(withInspection(TWO_CONTEXT_WORLD(), known()));
    const chrome = contextOrientation({ context, identity: { family: 'READING', id: 'reading-1' }, currentBindingId: 'binding-a', lineage: [] });

    expect(chrome.choiceAvailable).toBe(true);
    expect(chrome.appearances.map((option) => option.label)).toEqual(['The context you are looking through now', 'Taken up at moment 3']);
    for (const option of chrome.appearances) {
      for (const internal of INTERNALS) expect(option.label).not.toContain(internal);
    }
  });
});

describe('R1-04 — the unknown state still leaks nothing at all', () => {
  it('an identity unknown at TC speaks no family word, no route and no chooser', async () => {
    const store = historicalStore();
    inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const projection = projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), unknownAtTc())));
    const model = orientationModel(store, projection);
    expect(model.inspection.render).toEqual({ kind: 'IDENTITY_UNKNOWN_AT_TC' });

    const view = await render(<OrientationChrome surface={chromeSurface(store)} projection={projection} />);
    const words = spoken(view);
    expect(words).toContain('This moment does not know what you asked to inspect.');
    // Not even the plain-language family word, which would still confirm what kind of thing it is.
    expect(words).not.toContain('a reading');
    expect(words).not.toContain('Inside');
    expect(view.queryByTestId(CONTEXT_CHOICE_TEST_ID)).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });

  it('the fully-populated chrome names a Moment, which is reader-facing Product truth', async () => {
    const view = await render(
      <OrientationChrome surface={chromeSurface(reader())} projection={projectionFor(reader(), fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />,
    );
    // A Session Position is the one number the Product already shows a reader everywhere.
    expect(spoken(view)).toContain('Reading at moment 4.');

    await act(async () => {
      view.unmount();
    });
  });
});
