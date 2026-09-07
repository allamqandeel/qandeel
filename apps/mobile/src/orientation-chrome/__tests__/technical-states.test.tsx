/**
 * T-08 R4 — D40: a technical client state may never acquire world meaning.
 *
 * The type was always right — `PROJECTION_NOT_FETCHED` is its own member and becomes no other. The
 * COPY was not. "This moment has not arrived yet." / «لم تصل هذه اللحظة بعد.» make the *moment* the
 * subject that has not arrived, which asserts something about history. Frozen T-03C says
 * `NOT_FETCHED` means only that the client has not obtained the disclosure for this viewpoint, and
 * says nothing whatever about whether the moment happened.
 *
 * So the oracle here is not another forbidden-word list. It is positive: the sentence must be the
 * intended one, its subject must be the SHOWING, and it must remain true of a moment that provably
 * already happened — a position the reader is pinned behind, with Live already past it. A wording
 * that implied non-occurrence would be false of exactly that reader, and that is the case this file
 * builds.
 */
import { act, render } from '@testing-library/react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { OrientationChrome } from '../OrientationChrome';
import { orientationModel } from '../model';
import { inspectionSentence } from '../product-copy';
import type { ChromeLanguage } from '../types';
import { chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, known, projectionFor, readableText, TWO_CONTEXT_WORLD, unknownAtTc, withInspection } from '../__fixtures__/chrome';

const LANGUAGES: readonly ChromeLanguage[] = ['ar', 'en'];

/** The exact sentences. A positive oracle, not a denylist that passes until someone widens it. */
const NOT_FETCHED = Object.freeze({
  en: 'This moment is not ready to show yet.',
  ar: 'لم يكتمل عرض هذه اللحظة بعد.',
});

/** The wordings this file exists to keep out. They asserted that the MOMENT had not arrived. */
const REGRESSIONS = ['This moment has not arrived yet.', 'لم تصل هذه اللحظة بعد.'];

/**
 * A reader pinned at moment 4 with Live already at 6, inspecting something, holding no disclosure.
 *
 * The moment provably happened — Live has moved past it — so any wording implying it had not
 * occurred would be false of this exact reader.
 */
function pinnedBehindLiveWithNothingFetched() {
  const store = historicalStore();
  inspect(store, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
  return { store, projection: projectionFor(store, { status: 'NOT_FETCHED' }) };
}

describe('R4 / D40 — the not-fetched state says only what it can prove', () => {
  it('1 — the typed state is unchanged, and remains its own member', () => {
    const { store, projection } = pinnedBehindLiveWithNothingFetched();
    const model = orientationModel(store, projection);
    expect(model.projection).toEqual({ status: 'NOT_FETCHED' });
    expect(model.inspection.render).toEqual({ kind: 'PROJECTION_NOT_FETCHED' });
    // The reader is demonstrably standing behind a Live Head that has moved on, so the moment they
    // are reading at has certainly occurred.
    expect(model.temporal.mode).toBe('PINNED');
    expect(model.temporal.at).toBe(sessionPosition(4));
    expect(model.live.advancedWhileHistorical).toBe(true);
  });

  it.each(LANGUAGES)('5 — the %s sentence is the intended one, and it is about the showing', (language) => {
    const sentence = inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' });
    // The positive oracle.
    expect(sentence).toBe(NOT_FETCHED[language]);
    // And the subject really is the showing rather than the moment: each language names the act of
    // showing explicitly.
    expect(sentence).toContain(language === 'ar' ? 'عرض' : 'show');
  });

  it.each(LANGUAGES)('3 — the %s sentence never claims the moment failed to happen', (language) => {
    const sentence = inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' });
    for (const regression of REGRESSIONS) expect(sentence).not.toBe(regression);
    // The specific claims that would turn a client fact into a fact about history.
    const forbidden =
      language === 'en'
        ? ['has not arrived', 'did not happen', 'has not happened', 'does not exist', 'never existed', 'is unknown', 'was not there', 'no longer exists']
        : ['لم تصل', 'لم تحدث', 'غير موجودة', 'غير معروفة', 'لم تقع', 'غير معروف'];
    for (const claim of forbidden) expect(sentence).not.toContain(claim);
  });

  it.each(LANGUAGES)('2 — the %s sentence exposes no transport, cache or enum vocabulary', (language) => {
    const sentence = inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' });
    for (const internal of ['fetch', 'FETCH', 'NOT_FETCHED', 'PROJECTION', 'cache', 'request', 'RPC', 'endpoint', 'HTTP', 'disclosure', 'projection']) {
      expect(sentence).not.toContain(internal);
    }
  });

  it.each(LANGUAGES)('4 — the %s not-fetched sentence differs in meaning from unknown-at-TC', (language) => {
    const notFetched = inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' });
    const unknown = inspectionSentence(language, { kind: 'IDENTITY_UNKNOWN_AT_TC' });
    expect(notFetched).not.toBe(unknown);
    // Unknown-at-TC is the one that may speak about knowledge; not-fetched must not borrow it.
    expect(unknown).toContain(language === 'ar' ? 'غير معروف' : 'does not know');
    expect(notFetched).not.toContain(language === 'ar' ? 'غير معروف' : 'does not know');
    // ...and it must not borrow the refusal's wording either: a refusal is a different client fact.
    expect(notFetched).not.toBe(inspectionSentence(language, { kind: 'PROJECTION_UNAVAILABLE', code: 'HISTORICAL_COVERAGE_UNAVAILABLE' }));
    expect(notFetched).not.toBe(inspectionSentence(language, { kind: 'PROJECTION_STALE', reason: 'TEMPORAL_POSITION_CHANGED' }));
  });

  it.each(LANGUAGES)('6 — the %s rendered and spoken output carries exactly that sentence', async (language) => {
    const { store, projection } = pinnedBehindLiveWithNothingFetched();
    const view = await render(<OrientationChrome language={language} surface={chromeSurface(store)} projection={projection} />);

    const statement = view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children as string;
    expect(statement).toBe(NOT_FETCHED[language]);
    // It is text, so a screen reader reaches it; there is no separate accessibility wording to drift.
    const spoken = readableText(view.toJSON()).join(' | ');
    expect(spoken).toContain(NOT_FETCHED[language]);
    for (const regression of REGRESSIONS) expect(spoken).not.toContain(regression);

    await act(async () => {
      view.unmount();
    });
  });

  it('7 — both languages say the same technical-only thing, and neither says more than the other', () => {
    const en = inspectionSentence('en', { kind: 'PROJECTION_NOT_FETCHED' });
    const ar = inspectionSentence('ar', { kind: 'PROJECTION_NOT_FETCHED' });
    // Each names the showing and defers it; neither names the moment as the thing that is missing.
    expect(en).toContain('show');
    expect(ar).toContain('عرض');
    expect(en).toContain('yet');
    expect(ar).toContain('بعد');
    // Neither is the other's literal shape, and neither carries a claim the other lacks.
    expect(en).not.toBe(ar);
  });

  it('D40, D41 — the four technical states stay four different sentences', () => {
    for (const language of LANGUAGES) {
      const sentences = [
        inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' }),
        inspectionSentence(language, { kind: 'PROJECTION_STALE', reason: 'TEMPORAL_POSITION_CHANGED' }),
        inspectionSentence(language, { kind: 'INSPECTION_NOT_RESOLVED' }),
        inspectionSentence(language, { kind: 'RESOLUTION_MALFORMED' }),
      ];
      // `PROJECTION_UNAVAILABLE` and `PROJECTION_INCOHERENT` legitimately share one reader sentence —
      // to a reader they ARE the same thing — while remaining separate members of the union. The
      // four above must not join them.
      expect(new Set(sentences).size).toBe(4);
    }
  });

  it('the not-fetched sentence is true of a moment that certainly happened', async () => {
    // The strongest form of the oracle: a reader whose own Live Head is already past this moment.
    const store: CanonicalStore = chromeStore({ liveHead: 9, temporal: { kind: 'PINNED', at: sessionPosition(2) }, depth: 'ANALYTICAL_OBJECT' });
    inspect(historicalStore(), contextAt(withInspection(TWO_CONTEXT_WORLD(), known())), { family: 'READING', id: 'reading-1' });
    const model = orientationModel(store, projectionFor(store, { status: 'NOT_FETCHED' }));
    expect(model.temporal.earlierThanLiveHead).toBe(true);
    // Nothing about that reader's position makes the sentence false, in either language.
    for (const language of LANGUAGES) {
      expect(inspectionSentence(language, { kind: 'PROJECTION_NOT_FETCHED' })).toBe(NOT_FETCHED[language]);
    }
    // And an unknown identity remains a different answer entirely, so the two never merge.
    const unknownStore = historicalStore();
    inspect(unknownStore, contextAt(TWO_CONTEXT_WORLD()), { family: 'READING', id: 'reading-1' });
    const unknownModel = orientationModel(unknownStore, projectionFor(unknownStore, fetched(withInspection(TWO_CONTEXT_WORLD(), unknownAtTc()))));
    expect(unknownModel.inspection.render).toEqual({ kind: 'IDENTITY_UNKNOWN_AT_TC' });
  });
});
