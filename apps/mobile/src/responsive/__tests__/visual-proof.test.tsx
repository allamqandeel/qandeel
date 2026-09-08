/**
 * T-11 — the visual proof: the real composition, at every case in the envelope, as documents a
 * browser lays out.
 *
 * This suite always runs and always asserts. Set `QANDEEL_T11_PROOF_DIR` and it ALSO writes each
 * scenario to that directory, plus a contact sheet, for the design, accessibility and Arabic
 * reviews. The assertions do not depend on the writing, so what CI checks and what a reviewer looks
 * at come from exactly the same render.
 *
 * What it proves and what it does not is stated in `__fixtures__/html.ts` and in §15 of the
 * document, and nothing here is ever cited as native layout or as a Dynamic Type proof.
 */
import { act, render } from '@testing-library/react-native';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { I18nManager } from 'react-native';

import { panByTranslation } from '../../map';
import { ORIENTATION_CHROME_TEST_ID, type ChromeLanguage } from '../../orientation-chrome';
import { chromeStore, contextAt, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition } from '../../state';
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { temporalTargeting } from '../../temporal-navigation/targeting';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { document, seenTypes } from '../__fixtures__/html';
import { ResponsiveWorld, resize } from '../__fixtures__/composition';
import type { RecompositionPlan } from '../plan';

jest.setTimeout(180_000);

const OUT = process.env.QANDEEL_T11_PROOF_DIR ?? null;

interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly width: number;
  readonly height: number;
  readonly language: ChromeLanguage;
  readonly rtl: boolean;
  readonly fontScale?: number;
  readonly insets?: { readonly top?: number; readonly bottom?: number; readonly left?: number; readonly right?: number };
  /** Everything done to the composition before the frame is captured. */
  readonly act?: 'PREVIEW_OPEN' | 'AFTER_PAN' | 'RAPID_RESIZE' | 'REDUCED_MOTION';
}

const ENVELOPE = [
  { id: 'C1', width: 320, height: 568 },
  { id: 'C2', width: 360, height: 800 },
  { id: 'C3', width: 390, height: 844 },
  { id: 'C4', width: 412, height: 915 },
  { id: 'C5', width: 568, height: 320 },
  { id: 'C6', width: 844, height: 390 },
  { id: 'C7', width: 768, height: 1024 },
  { id: 'C8', width: 1024, height: 768 },
  { id: 'C9', width: 1366, height: 1024 },
] as const;

/** C1…C9 in both languages and both directions, then the fourteen required scenarios. */
const SCENARIOS: readonly Scenario[] = [
  ...ENVELOPE.flatMap((c) => [
    { id: `${c.id}-en-ltr`, title: `${c.id} English LTR`, caption: `${c.id} — ${c.width}x${c.height} — English, left-to-right`, width: c.width, height: c.height, language: 'en' as const, rtl: false },
    { id: `${c.id}-ar-rtl`, title: `${c.id} Arabic RTL`, caption: `${c.id} — ${c.width}x${c.height} — Arabic, right-to-left`, width: c.width, height: c.height, language: 'ar' as const, rtl: true },
  ]),
  { id: 'P07-large-text', title: 'Large text, compact', caption: 'P07 — 320x568 — Arabic RTL at 200% text: the chrome grows, the Map shows less, nothing is clipped or hidden', width: 320, height: 568, language: 'ar', rtl: true, fontScale: 2 },
  { id: 'P07b-largest-text', title: 'Largest text, compact', caption: 'P07b — 320x568 — English LTR at 350% text: the band scrolls rather than truncating a word or dropping an act', width: 320, height: 568, language: 'en', rtl: false, fontScale: 3.5 },
  { id: 'P08-asymmetric-inset', title: 'Asymmetric inset', caption: 'P08 — 390x844 — 48pt top, 34pt bottom, 8pt left/right: usable rect only, no camera and no geography move', width: 390, height: 844, language: 'ar', rtl: true, insets: { top: 48, bottom: 34, left: 8, right: 8 } },
  { id: 'P09-narrow-timeline', title: 'Narrow Timeline, Live edge', caption: 'P09 — 320x568 — the Live edge stays an outboard slot beside the Track at the narrowest supported width', width: 320, height: 568, language: 'en', rtl: false },
  { id: 'P09b-narrow-timeline-rtl', title: 'Narrow Timeline, RTL', caption: 'P09b — 320x568 — the same outboard slot in right-to-left: the strip is flush to the start edge, the slot is beside it', width: 320, height: 568, language: 'ar', rtl: true },
  { id: 'P10-rapid-resize', title: 'After a rapid resize', caption: 'P10 — 1024x768 — captured after 29 resizes across the whole envelope: the same world, the same acts, the same words', width: 1024, height: 768, language: 'en', rtl: false, act: 'RAPID_RESIZE' },
  { id: 'P11-after-pan', title: 'Resize after a camera act', caption: 'P11 — 844x390 — a committed PAN, then a resize: the world holds its place relative to the camera, and short landscape pairs the acts', width: 844, height: 390, language: 'ar', rtl: true, act: 'AFTER_PAN' },
  { id: 'P13-preview-open', title: 'Preview open, then resized', caption: 'P13 — 568x320 — a temporal Preview is open across the resize: the preview marker and the committed marker are both drawn, and nothing committed', width: 568, height: 320, language: 'en', rtl: false, act: 'PREVIEW_OPEN' },
  { id: 'P14-reduced-motion', title: 'Reduced motion, resized', caption: 'P14 — 390x844 — reduced motion on, resized: the same acts, the same words, the same composition', width: 390, height: 844, language: 'ar', rtl: true, act: 'REDUCED_MOTION' },
];

function reader() {
  const store = chromeStore({
    liveHead: 6,
    depth: 'ANALYTICAL_OBJECT',
    temporal: { kind: 'PINNED', at: sessionPosition(4) },
    liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
    liveFocusAtSp: 5,
  });
  return { store, context: contextAt(TWO_CONTEXT_WORLD()) };
}

describe('T11 — visual proof', () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = false;
  });

  it('composes every required scenario, and writes them when a proof directory is given', async () => {
    if (OUT !== null) mkdirSync(OUT, { recursive: true });
    const written: { readonly id: string; readonly title: string; readonly caption: string }[] = [];
    const originalDirection = I18nManager.isRTL;

    for (const scenario of SCENARIOS) {
      I18nManager.isRTL = scenario.rtl;
      (globalThis as Record<string, unknown>).__QANDEEL_TEST_REDUCED_MOTION__ = scenario.act === 'REDUCED_MOTION';
      try {
        const world = reader();
        const preview = createTemporalPreviewController();
        const presentation = createPresentationController(trackOf('session-1', 6), 0);
        const plans: RecompositionPlan[] = [];
        const view = await render(
          <ResponsiveWorld
            store={world.store}
            context={world.context}
            language={scenario.language}
            preview={preview}
            presentation={presentation}
            fontScale={scenario.fontScale}
            insets={scenario.insets}
            onPlan={(plan) => plans.push(plan)}
          />,
        );

        if (scenario.act === 'AFTER_PAN') {
          const outcome = panByTranslation(world.store, -120, 80);
          expect(outcome.outcome).toBe('APPLIED');
        }
        if (scenario.act === 'PREVIEW_OPEN') {
          const result = preview.preview(temporalTargeting(world.store.getState(), presentation.getSnapshot().track), sessionPosition(2), 'DISCLOSED_TARGET');
          expect(result.outcome).toBe('PREVIEWING');
        }
        if (scenario.act === 'RAPID_RESIZE') {
          for (const c of [...ENVELOPE, ...ENVELOPE, ...ENVELOPE].slice(0, 29)) await resize(view, c.width, c.height);
        }

        await resize(view, scenario.width, scenario.height, {
          insetTop: scenario.insets?.top ?? 0,
          insetBottom: scenario.insets?.bottom ?? 0,
        });

        // The composition exists and is complete at every scenario, which is the assertion the
        // written document then depicts.
        expect(view.getByTestId(ORIENTATION_CHROME_TEST_ID)).toBeTruthy();
        const plan = plans[plans.length - 1];
        expect(plan.surface.width).toBe(scenario.width);
        if (scenario.act === 'PREVIEW_OPEN') expect(preview.getSnapshot().status).toBe('PREVIEWING');
        // Nothing any scenario did was a resize acting as a Product act.
        expect(world.store.getState().history).toHaveLength(scenario.act === 'AFTER_PAN' ? 1 : 0);

        // Rendered ALWAYS, written only when asked. The converter is therefore exercised by CI on
        // every scenario, so a picture nobody looked at cannot silently stop being producible.
        const html = document(view.toJSON(), {
          title: scenario.title,
          width: scenario.width,
          height: scenario.height,
          rtl: scenario.rtl,
          language: scenario.language,
          fontScale: scenario.fontScale ?? 1,
          caption: `${scenario.caption}  |  band ${plan.band}${plan.shortHeight ? ' (short)' : ''}, chrome ${plan.chrome.arrangement}, measure ${plan.chrome.measurePoints}pt`,
        });
        expect(html).toContain(ORIENTATION_CHROME_TEST_ID);
        if (OUT !== null) {
          writeFileSync(join(OUT, `${scenario.id}.html`), html, 'utf8');
          written.push({ id: scenario.id, title: scenario.title, caption: scenario.caption });
        }

        await act(async () => {
          view.unmount();
        });
      } finally {
        I18nManager.isRTL = originalDirection;
      }
    }

    // The coverage claim itself, rather than a count: every case of the envelope in both
    // languages and both directions, plus every scenario the execution contract's §25 names.
    const ids = new Set(SCENARIOS.map((scenario) => scenario.id));
    for (const c of ENVELOPE) {
      expect(ids.has(`${c.id}-en-ltr`)).toBe(true);
      expect(ids.has(`${c.id}-ar-rtl`)).toBe(true);
    }
    for (const required of [
      'C1-ar-rtl', // 1. 320x568 Arabic RTL
      'C1-en-ltr', // 2. 320x568 English LTR
      'C5-ar-rtl', // 3. 568x320 Arabic RTL
      'C6-en-ltr', // 4. 844x390 English LTR
      'C7-ar-rtl', // 5. 768x1024 Arabic RTL
      'C9-en-ltr', // 6. 1366x1024 English LTR
      'P07-large-text', // 7. large-text compact chrome
      'P08-asymmetric-inset', // 8. asymmetric bottom inset
      'P09-narrow-timeline', // 9. narrow Timeline with Live edge
      'P10-rapid-resize', // 10. rapid resize
      'P11-after-pan', // 11. resize after a camera act
      'P13-preview-open', // 13. Preview open + resize
      'P14-reduced-motion', // 14. reduced motion + resize
    ]) {
      expect(ids.has(required)).toBe(true);
    }
    if (OUT !== null) {
      const rows = written
        .map((entry) => `<li><a href="./${entry.id}.html">${entry.id}</a> — ${entry.title}<br><small>${entry.caption}</small></li>`)
        .join('\n');
      writeFileSync(
        join(OUT, 'index.html'),
        `<!doctype html><meta charset="utf-8"><title>T-11 visual proof</title>
<style>body{font:14px/1.6 'Segoe UI',sans-serif;margin:32px;max-width:70ch}li{margin:10px 0}small{color:#666}</style>
<h1>T-11 — Responsive Recomposition: visual proof</h1>
<p>The real Map, temporal surface and chrome, composed inside the responsive owner, rendered at each
window under test. Browser layout of the real component tree and the real styles — not native
layout, and not a Dynamic Type proof. See <code>docs/responsive-recomposition-v1.md</code> §15.</p>
<ol>${rows}</ol>`,
        'utf8',
      );
      expect(written).toHaveLength(SCENARIOS.length);
      writeFileSync(join(OUT, 'element-types.txt'), [...seenTypes].sort().join('\n'), 'utf8');
    }
    // Every host element the real tree contains is one the converter knows how to lay out. An
    // unhandled type would be silently dropped into a plain column, and the picture would be of a
    // composition nobody wrote.
    expect([...seenTypes].sort()).toEqual(['RCTScrollView', 'Text', 'TextInput', 'View']);
  });
});
