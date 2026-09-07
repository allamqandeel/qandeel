/**
 * T-08 R3-01 — Arabic and English are both real Product languages, and neither is the semantics.
 *
 * The claim under test is not "the strings were translated". It is that the ANSWER is computed
 * without knowing which language will state it, so the two surfaces can never disagree about what is
 * true. That is proved three ways here:
 *
 *   - the semantic model carries no sentence at all, so there is nothing in it to translate;
 *   - every offered act, every chooser membership and every canonical effect is identical in both;
 *   - the no-hindsight differential holds SEPARATELY in each language, because a leak that only
 *     appeared in Arabic would have passed an English-only proof.
 *
 * Reading direction is tested as a SEPARATE axis throughout: `I18nManager.isRTL` never selects a
 * language and a language never selects a direction, so all four combinations are legitimate and all
 * four are exercised.
 */
import { act, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { CONTEXT_CHOICE_TEST_ID, INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { ORIENTATION_CHROME_TEST_ID, OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { RETURN_OPPORTUNITY_IDS, type ChromeLanguage } from '../types';
import {
  chromeStore,
  chromeSurface,
  contextAt,
  fetched,
  historicalStore,
  inspect,
  known,
  offeredIds,
  projectionFor,
  readableText,
  TWO_CONTEXT_WORLD,
  withInspection,
  world,
} from '../__fixtures__/chrome';

const LANGUAGES: readonly ChromeLanguage[] = ['ar', 'en'];
const ARABIC = /[\u0600-\u06FF]/u;
/** Latin letters. Their ABSENCE in Arabic copy is what proves it is not English left untranslated. */
const LATIN = /[A-Za-z]/u;

/** Runs a block with the platform direction mirrored, restoring it whatever happens. */
async function inRtl(block: () => Promise<void>): Promise<void> {
  const original = I18nManager.isRTL;
  I18nManager.isRTL = true;
  try {
    await block();
  } finally {
    I18nManager.isRTL = original;
  }
}

const reader = (over: Parameters<typeof chromeStore>[0] = {}): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
    ...over,
  });

/** A reader inspecting a Reading that is disclosed in two Threads, so the chooser is populated. */
function inspecting() {
  const store = historicalStore();
  inspect(store, contextAt(TWO_CONTEXT_WORLD()), {
    family: 'READING',
    id: 'reading-1',
    appearance: { kind: 'THREAD_READING', bindingId: 'binding-a' },
  });
  return { store, projection: projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))) };
}

const renderIn = (language: ChromeLanguage, store: CanonicalStore, projection: ReturnType<typeof projectionFor>) =>
  render(
    <OrientationChrome
      language={language}
      surface={chromeSurface(store)}
      projection={projection}
      liveContext={() => ({ ok: false, code: 'PROJECTION_NOT_AVAILABLE', detail: 'none' })}
    />,
  );

/** Every word a reader can see or hear, joined. */
const spoken = (view: Awaited<ReturnType<typeof render>>): string => readableText(view.toJSON()).join(' | ');

/** The offered controls as (identity, label, hint) rows, in the frozen logical order. */
const controlRows = (view: Awaited<ReturnType<typeof render>>) =>
  RETURN_OPPORTUNITY_IDS.flatMap((id) => {
    const control = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
    return control === null ? [] : [{ id, label: control.props.accessibilityLabel as string, hint: control.props.accessibilityHint as string }];
  });

describe('R3-01 — the semantic model is language-neutral by construction', () => {
  it('1, 2, 6 — the orientation model contains no sentence at all, so there is nothing in it to translate', () => {
    const { store, projection } = inspecting();
    const model = orientationModel(store, projection, { liveContextAvailable: true });

    // A sentence is a string with a space in it. Every string this model carries is a frozen token
    // or an opaque handle; the moment one of them became reader-facing prose, the model would have
    // started to depend on a language and this would fail.
    const sentences: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') {
        if (/\s/u.test(node)) sentences.push(node);
        return;
      }
      if (Array.isArray(node)) return node.forEach(walk);
      if (node !== null && typeof node === 'object') return Object.values(node).forEach(walk);
    };
    walk(model);
    expect(sentences).toEqual([]);

    // And the oracle itself takes no language: the whole answer is derived before any word is chosen.
    expect(orientationModel).toHaveLength(2);
  });

  it('7, 8, 9, 23 — offered acts, chooser membership and canonical geography are identical in both languages', async () => {
    const rows: Record<string, unknown> = {};
    for (const language of LANGUAGES) {
      const { store, projection } = inspecting();
      const before = store.getState();
      const view = await renderIn(language, store, projection);
      rows[language] = {
        offered: controlRows(view).map((row) => row.id),
        options: view
          .getByTestId(CONTEXT_CHOICE_TEST_ID)
          .props.children.flat()
          .filter(Boolean).length,
        // Rendering writes nothing: the same canonical object is still in place afterwards.
        untouched: store.getState() === before,
        camera: JSON.stringify(store.getState().camera),
      };
    }
    expect(rows.ar).toEqual(rows.en);
  });

  it('10 — every offered act reaches the same executor and produces the same canonical result in both languages', async () => {
    for (const id of RETURN_OPPORTUNITY_IDS) {
      const results: string[] = [];
      for (const language of LANGUAGES) {
        const { store, projection } = inspecting();
        const view = await renderIn(language, store, projection);
        const control = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
        if (control === null) {
          results.push('ABSENT');
        } else {
          await act(async () => {
            control.props.onClick();
          });
          results.push(JSON.stringify(store.getState()));
        }
        await act(async () => {
          view.unmount();
        });
      }
      // Same act, same effect. A language that routed anywhere else would diverge here.
      expect(results[0]).toBe(results[1]);
    }
  });
});

describe('R3-01 — each language really is its own language', () => {
  it('1, 15, 16 — Arabic renders Arabic words and English renders English ones, in text and in accessibility', async () => {
    const { store, projection } = inspecting();

    const arabic = await renderIn('ar', store, projection);
    const arabicWords = spoken(arabic);
    expect(ARABIC.test(arabicWords)).toBe(true);
    // Only the Moment numbers are Latin characters, and they are digits rather than letters.
    expect(LATIN.test(arabicWords)).toBe(false);
    for (const row of controlRows(arabic)) {
      expect(ARABIC.test(row.label)).toBe(true);
      expect(ARABIC.test(row.hint)).toBe(true);
    }
    await act(async () => {
      arabic.unmount();
    });

    const english = await renderIn('en', store, projection);
    const englishWords = spoken(english);
    expect(LATIN.test(englishWords)).toBe(true);
    expect(ARABIC.test(englishWords)).toBe(false);
    for (const row of controlRows(english)) {
      expect(LATIN.test(row.label)).toBe(true);
      expect(ARABIC.test(row.label)).toBe(false);
    }
    await act(async () => {
      english.unmount();
    });
  });

  it('3, 4, 5 — reading direction and Product language are separate axes, and neither selects the other', async () => {
    const { store, projection } = inspecting();

    // 3, 4 — mirrored layout does NOT produce Arabic. RTL plus English words is not an Arabic UI,
    // and it is exactly what the earlier RTL-only proof mistook for one.
    await inRtl(async () => {
      const view = await renderIn('en', store, projection);
      const words = spoken(view);
      expect(ARABIC.test(words)).toBe(false);
      expect(LATIN.test(words)).toBe(true);
      await act(async () => {
        view.unmount();
      });
    });

    // 4 — and an unmirrored layout does not prevent Arabic.
    expect(I18nManager.isRTL).toBe(false);
    const arabicInLtr = await renderIn('ar', store, projection);
    expect(ARABIC.test(spoken(arabicInLtr))).toBe(true);

    // 5 — choosing a language changes no platform direction. T-08 never writes `I18nManager`.
    expect(I18nManager.isRTL).toBe(false);
    await act(async () => {
      arabicInLtr.unmount();
    });
  });

  it('19, 20 — a mixed Arabic, Latin and numeric world stays coherent and still speaks no handle', async () => {
    const BILINGUAL = () =>
      world({
        depth: 'ANALYTICAL_OBJECT',
        tc: 12,
        liveHead: 14,
        threads: [{ id: 'خيط-التحليل', x: '1000000', y: '0' }],
        appearances: [{ bindingId: 'ربط-QA-12', threadId: 'خيط-التحليل', readingId: 'قراءة-reading-7', boundSp: 3 }],
        readings: [{ id: 'قراءة-reading-7' }],
      });
    const store = historicalStore({ temporal: { kind: 'PINNED', at: sessionPosition(12) }, liveHead: 14 });
    inspect(store, contextAt(BILINGUAL()), { family: 'READING', id: 'قراءة-reading-7', appearance: { kind: 'THREAD_READING', bindingId: 'ربط-QA-12' } });
    const projection = projectionFor(store, fetched(withInspection(BILINGUAL(), known())));

    const view = await renderIn('ar', store, projection);
    const temporal = view.getByTestId(`${ORIENTATION_CHROME_TEST_ID}:temporal`).props.children as string;

    // 19 — the Moment is a Western numeral inside an Arabic sentence, and it survives intact: the
    // digit run is not reordered, not converted, and not split by the surrounding right-to-left text.
    expect(temporal).toContain('12');
    expect(temporal).not.toContain('21');
    expect(ARABIC.test(temporal)).toBe(true);
    // ONE numeral system per surface: no Eastern Arabic-Indic digit appears anywhere.
    expect(spoken(view)).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/u);
    // And no bidi control character is smuggled into the copy to make that work.
    expect(spoken(view)).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
    // 20 — the Arabic and code-switched handles drive the chrome and are never spoken.
    for (const handle of ['قراءة-reading-7', 'خيط-التحليل', 'ربط-QA-12']) {
      expect(spoken(view)).not.toContain(handle);
    }
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-01 — no hindsight, proved separately in each language', () => {
  /** Two positions that differ ONLY in a Live Focus this position cannot disclose. */
  const pair = () => ({
    none: reader({ liveFocus: { kind: 'NONE' } }),
    future: reader({ liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-that-does-not-exist-here' }, liveFocusAtSp: 5 }),
  });

  it.each(LANGUAGES)('11, 12, 13, 14 — an undisclosed future focus changes nothing a %s reader can see or hear', async (language) => {
    const { none, future } = pair();
    const trees: string[] = [];
    for (const store of [none, future]) {
      const view = await renderIn(language, store, projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known()))));
      trees.push(JSON.stringify(view.toJSON(), (_key, value) => (typeof value === 'function' ? '[handler]' : value)));
      // 13, 14 — and the future identity is nowhere in the words, in this language.
      expect(spoken(view)).not.toContain('thread-that-does-not-exist-here');
      await act(async () => {
        view.unmount();
      });
    }
    // The WHOLE rendered native tree is identical — not a chosen field of it.
    expect(trees[0]).toBe(trees[1]);
  });

  it.each(LANGUAGES)('17, 18 — nothing a %s screen reader hears is an identifier, a wire token, a rung enum or a refusal code', async (language) => {
    const { store, projection } = inspecting();
    const view = await renderIn(language, store, projection);
    const words = spoken(view);
    for (const internal of [
      'reading-1',
      'binding-a',
      'binding-b',
      'thread-a',
      'thread-b',
      'ANALYTICAL_OBJECT',
      'SOURCE_PROVENANCE',
      'EMERGING_FOCUS',
      'THREAD_READING',
      'HISTORICAL_COVERAGE_UNAVAILABLE',
      'PROJECTION_NOT_FETCHED',
      'UNKNOWN_AT_TC',
      'RETURN_LIVE_HEAD',
      'GO_LIVE_AND_LOCATE',
    ]) {
      expect(words).not.toContain(internal);
    }
    await act(async () => {
      view.unmount();
    });
  });
});

describe('R3-01 — mirroring changes no meaning in either language', () => {
  it.each(LANGUAGES)('21, 22 — the two Live acts and the two spatial acts keep their %s wording under RTL', async (language) => {
    const { store, projection } = inspecting();
    const upright = await renderIn(language, store, projection);
    const before = controlRows(upright);
    expect(before.length).toBeGreaterThan(0);
    await act(async () => {
      upright.unmount();
    });

    await inRtl(async () => {
      const mirrored = await renderIn(language, store, projection);
      // 21 — Live Head did not become Live Focus; 22 — Back did not become World. Same identities,
      // same words, same logical order, in a mirrored layout.
      expect(controlRows(mirrored)).toEqual(before);
      await act(async () => {
        mirrored.unmount();
      });
    });
  });

  it.each(LANGUAGES)('24 — the %s surface contains no arrow, chevron or mirroring escape hatch', async (language) => {
    const { store, projection } = inspecting();
    const view = await renderIn(language, store, projection);
    const serialized = JSON.stringify(view.toJSON());
    for (const glyph of ['←', '→', '↑', '↓', '⟵', '⟶', '◀', '▶', '‹', '›', '«', '»']) {
      expect(serialized).not.toContain(glyph);
    }
    expect(serialized).not.toContain('scaleX');
    expect(serialized).not.toContain('transform');
    await act(async () => {
      view.unmount();
    });
  });
});
