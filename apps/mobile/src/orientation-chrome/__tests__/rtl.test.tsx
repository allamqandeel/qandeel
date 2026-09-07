/**
 * T-08 — K: Arabic is first-class, and Product meaning never mirrors.
 *
 * Physical mirroring is React Native's own job and may rearrange this chrome's local layout. What
 * must NOT change is the meaning: Return to Live Head must not become Return to Live Focus because
 * the writing direction changed, Back must not become Return to World, the logical order of the six
 * must not reverse, and no glyph anywhere may encode a direction the Product has not proven.
 *
 * The strongest guarantee here is structural rather than tested: this surface contains no arrow, no
 * chevron, no icon and no direction word at all, so there is nothing for a mirror to invert.
 */
import { act, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { sessionPosition, type CanonicalStore } from '../../state';
import { INSPECTION_ORIENTATION_TEST_ID } from '../InspectionOrientation';
import { OrientationChrome } from '../OrientationChrome';
import { RETURN_CONTROLS_TEST_ID } from '../ReturnControls';
import { orientationModel } from '../model';
import { RETURN_OPPORTUNITY_IDS } from '../types';
import { chromeStore, chromeSurface, contextAt, fetched, historicalStore, inspect, known, projectionFor, TWO_CONTEXT_WORLD, withInspection, world } from '../__fixtures__/chrome';

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

const reader = (): CanonicalStore =>
  chromeStore({
    liveHead: 6,
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    depth: 'ANALYTICAL_OBJECT',
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });

/** The controls actually offered, as (identity, label, hint) rows, in the frozen logical order. */
function controlRows(view: Awaited<ReturnType<typeof render>>) {
  return RETURN_OPPORTUNITY_IDS.flatMap((id) => {
    const control = view.queryByTestId(`${RETURN_CONTROLS_TEST_ID}:${id}`);
    return control === null ? [] : [{ id, label: control.props.accessibilityLabel, hint: control.props.accessibilityHint }];
  });
}

const renderChrome = (store: CanonicalStore) =>
  render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projectionFor(store, fetched(withInspection(TWO_CONTEXT_WORLD(), known())))} />);

describe('OC08-K — mirroring changes no Product meaning', () => {
  it('K98, K99, K101 — the six keep their identities, order, labels and states under RTL', async () => {
    const ltrStore = reader();
    const ltrView = await renderChrome(ltrStore);
    const ltr = controlRows(ltrView);
    expect(ltr.length).toBeGreaterThan(0);
    await act(async () => {
      ltrView.unmount();
    });

    await inRtl(async () => {
      const rtlStore = reader();
      const rtlView = await renderChrome(rtlStore);
      const rtl = controlRows(rtlView);

      // Identical rows, in identical order: the logical order is not the physical one, and K101's
      // screen-reader traversal follows exactly this order because each row IS its own element.
      expect(rtl).toEqual(ltr);
      // K98/K99 — the two Live acts and the two spatial acts did not trade meanings, and the offered
      // set is a subsequence of the frozen order rather than a mirrored one.
      const frozen = RETURN_OPPORTUNITY_IDS.filter((id) => rtl.some((row) => row.id === id));
      expect(rtl.map((row) => row.id)).toEqual(frozen);

      await act(async () => {
        rtlView.unmount();
      });
    });
  });

  it('K100 — there is no arrow, chevron, icon or direction word to be mirrored', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const serialized = JSON.stringify(view.toJSON());
    // Every common directional glyph, in both bidi directions.
    for (const glyph of ['←', '→', '↑', '↓', '⟵', '⟶', '◀', '▶', '‹', '›', '«', '»', '<', '>']) {
      expect(serialized).not.toContain(glyph);
    }
    // And no RN mirroring escape hatch, which would only exist to flip something directional.
    expect(serialized).not.toContain('scaleX');
    expect(serialized).not.toContain('transform');

    await act(async () => {
      view.unmount();
    });
  });

  it('K102 — nothing truncates, so truncation can never reorder or guess an identity', async () => {
    const store = reader();
    const view = await renderChrome(store);
    const serialized = JSON.stringify(view.toJSON());
    expect(serialized).not.toContain('numberOfLines');
    expect(serialized).not.toContain('ellipsizeMode');

    await act(async () => {
      view.unmount();
    });
  });
});

describe('OC08-K — an Arabic and code-switched world produces the same internal-free chrome', () => {
  /** A disclosed world whose identities are Arabic, Latin and mixed with Western digits. */
  const BILINGUAL = () =>
    world({
      depth: 'ANALYTICAL_OBJECT',
      tc: 4,
      liveHead: 6,
      threads: [{ id: 'خيط-التحليل', x: '1000000', y: '0' }],
      appearances: [{ bindingId: 'ربط-QA-12', threadId: 'خيط-التحليل', readingId: 'قراءة-reading-7', boundSp: 2 }],
      readings: [{ id: 'قراءة-reading-7' }],
    });

  it('K96, K97 — Arabic and code-switched identities drive the chrome without ever being spoken', async () => {
    const check = async () => {
      const store = historicalStore();
      inspect(store, contextAt(BILINGUAL()), {
        family: 'READING',
        id: 'قراءة-reading-7',
        appearance: { kind: 'THREAD_READING', bindingId: 'ربط-QA-12' },
      });
      const projection = projectionFor(store, fetched(withInspection(BILINGUAL(), known())));
      const model = orientationModel(store, projection);
      // The typed answer carries the exact Arabic identity, unnormalized and untransliterated.
      expect(model.inspection.render).toMatchObject({ kind: 'RENDERABLE', id: 'قراءة-reading-7' });

      const view = await render(<OrientationChrome language="en" surface={chromeSurface(store)} projection={projection} />);
      const statement = view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:statement`).props.children as string;
      const lineage = view.getByTestId(`${INSPECTION_ORIENTATION_TEST_ID}:lineage`).props.children as string;

      // R1-05: an identifier is an identifier in every script. Arabic ids are internal exactly as
      // Latin ones are, so the reader sees the structure of their position, never the handles.
      expect(statement).toBe('You are inspecting a reading.');
      expect(lineage).toBe('Inside a thread, inside a place.');
      for (const identifier of ['قراءة-reading-7', 'خيط-التحليل', 'ربط-QA-12']) {
        expect(statement).not.toContain(identifier);
        expect(lineage).not.toContain(identifier);
      }

      await act(async () => {
        view.unmount();
      });
      return { statement, lineage };
    };

    const ltr = await check();
    let rtl: { statement: string; lineage: string } | null = null;
    await inRtl(async () => {
      rtl = await check();
    });
    // The words and their logical order are identical; only physical layout may differ.
    expect(rtl).toEqual(ltr);
  });
});
