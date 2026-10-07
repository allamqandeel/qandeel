/**
 * S5-03B R1 — the Living Analysis SCREEN is exactly what it was before the screen extraction.
 *
 * `../../map/__tests__/golden-equivalence.test.tsx` pins the world (MapSurface / MapCanvas). This pins the SCREEN around
 * it: the real `LivingAnalysisMap` over the real bootstrapped runtime, with the real responsive owner, the real Timeline
 * row, the real temporal orientation line and the real Orientation Chrome. Every host element is recorded in order with
 * every prop — type, testID, accessibility, resolved style — functions by name and animated handles by their value.
 *
 * It was recorded against the composition BEFORE `LivingAnalysisSurface` / `WorldViewSurface` existed, and it is never
 * regenerated to match a refactor: the refactor matches it.
 *
 * LA-VIS-01 — CONTROLLED RE-ANCHOR (2026-10-07, graphics-only fidelity upgrade of the shared world material, not a
 * refactor): the golden was regenerated ONCE because the paint itself was intentionally changed. Before it was rewritten,
 * a structural diff of the old and new golden proved that every case differs in Skia paint ONLY — the host tree (views,
 * testIDs, handlers, accessibility) and every mark anchor (origin, order, count) are identical in every case.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { inspectObject, mapInspectionContext, mapProjectionRequest, panByTranslation, zoomSemanticStep } from '../../map';
import type { HistoricalSemanticDepth } from '../../projection';
import { resize } from '../../responsive/__fixtures__/composition';
import { sessionPosition } from '../../state';
import { commitMoment, temporalTargeting } from '../../temporal-navigation';
import { LivingAnalysisMap } from '../composition/LivingAnalysisMap';
import { productLocale, type LayoutDirection } from '../locale/product-locale';
import { harness, settle, SESSION_A, type IntegrationHarness } from '../__fixtures__/integration';
import type { Responder } from '../../runtime-entry/__fixtures__/runtime-entry';
import type { ChromeLanguage } from '../../orientation-chrome';

const GOLDEN = join(__dirname, '__golden__', 'living-analysis-screen.golden.json');
const WRITE = process.env.QANDEEL_WRITE_GOLDEN === '1';

const LIVE_HEAD = 6;
const STEP = 1_000_000;
const THREADS = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: String(STEP / 2), y: '0' },
  { id: 'thread-c', x: String(-STEP / 2), y: String(STEP / 4) },
];
const APPEARANCES = [{ bindingId: 'binding-1', threadId: 'thread-a', readingId: 'reading-1', boundSp: 2 }];
const READINGS = [{ id: 'reading-1' }, { id: 'reading-orphan' }];
const FOCUSES = [{ id: 'focus-1', startedSp: 3 }];

/** Every host element in order, with every prop: functions by name, animated handles by their current value. */
function serialise(json: unknown): unknown {
  const value = (input: unknown, depth = 0): unknown => {
    if (typeof input === 'function') return '[fn]';
    if (input === null || typeof input !== 'object') return typeof input === 'number' && !Number.isFinite(input) ? String(input) : input;
    if (depth > 8) return '[deep]';
    if (Array.isArray(input)) return input.map((entry) => value(entry, depth + 1));
    const record = input as Record<string, unknown>;
    if ('value' in record && typeof (record as { get?: unknown }).get === 'function') return { $animated: value(record.value, depth + 1) };
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = value(record[key], depth + 1);
    return out;
  };
  const node = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(node);
    const record = input as { type?: string; props?: Record<string, unknown>; children?: unknown[] | null };
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(record.props ?? {}).sort()) props[key] = value(record.props![key]);
    return { type: record.type, props, children: (record.children ?? []).map(node) };
  };
  return node(json);
}

interface Screen {
  readonly language?: ChromeLanguage;
  readonly direction?: LayoutDirection;
  readonly fontScale?: number;
  readonly width?: number;
  readonly height?: number;
  /** Depths whose projection never answers, so a viewpoint asking for them stays unsettled. */
  readonly withhold?: readonly HistoricalSemanticDepth[];
  /** Runs before anything is mounted. */
  readonly before?: () => void;
  /** Acts on the composed screen, then the screen is settled again. */
  readonly act?: (h: IntegrationHarness) => void;
}

const harnesses: IntegrationHarness[] = [];

async function screen(options: Screen = {}): Promise<RenderResult> {
  options.before?.();
  // The same wire-legal disclosures the VPORT-01 proof world serves: a few Homes, a hosted Reading, an ungrounded
  // Reading and an Emerging Focus, at whatever rung the viewpoint asks for — so the Map has a world and the Track has
  // its Moments.
  const projection: Responder = (request) => {
    const params = new URL(request.url).searchParams;
    const depth = (params.get('depth') ?? 'WORLD') as HistoricalSemanticDepth;
    if (options.withhold?.includes(depth)) return new Promise(() => undefined);
    return {
      status: 200,
      body: disclosureFixture({
        depth,
        sessionId: SESSION_A,
        tc: Number(params.get('tc') ?? LIVE_HEAD),
        liveHead: LIVE_HEAD,
        threads: THREADS,
        appearances: APPEARANCES,
        readings: READINGS,
        focuses: FOCUSES,
      }),
    };
  };
  const h = await harness({ liveHead: LIVE_HEAD, projection });
  harnesses.push(h);
  const width = options.width ?? 390;
  const height = options.height ?? 844;
  const insets = { top: 44, bottom: 34, left: 0, right: 0 };
  const view = await render(
    <LivingAnalysisMap
      runtime={h.ready()}
      locale={productLocale(options.language ?? 'en', options.direction ?? 'LTR')}
      insets={insets}
      fontScale={options.fontScale ?? 1}
      envelope={{ width, height }}
    />,
  );
  await act(async () => {
    await settle();
  });
  await resize(view, width, height, { insetTop: insets.top, insetBottom: insets.bottom });
  await act(async () => {
    await settle();
  });
  if (options.act !== undefined) {
    await act(async () => {
      options.act!(h);
      await settle();
    });
    await act(async () => {
      await settle();
    });
  }
  return view;
}

const cases: Record<string, () => Promise<unknown>> = {};
const capture = (name: string, options: Screen = {}) => {
  cases[name] = async () => serialise((await screen(options)).toJSON());
};

capture('en-compact-following-live');
capture('ar-rtl-compact-following-live', { language: 'ar', direction: 'RTL' });
capture('en-expansive', { width: 1180, height: 820 });
capture('ar-rtl-expansive', { language: 'ar', direction: 'RTL', width: 1180, height: 820 });
capture('short-landscape', { width: 844, height: 390 });
capture('large-text-200', { fontScale: 2, width: 320, height: 568 });
capture('ar-large-text-200', { language: 'ar', direction: 'RTL', fontScale: 2, width: 320, height: 568 });
capture('return-offered-after-pan', { act: (h) => expect(panByTranslation(h.ready().store, 48, 0).outcome).toBe('APPLIED') });
capture('previewing', {
  act: (h) => {
    const runtime = h.ready();
    const targeting = temporalTargeting(runtime.store.getState(), runtime.presentation.getSnapshot().track);
    expect(runtime.preview.preview(targeting, sessionPosition(3), 'DISCLOSED_TARGET').outcome).toBe('PREVIEWING');
  },
});
capture('historical-not-live-return-offered', { act: (h) => expect(commitMoment(h.ready().store, sessionPosition(3)).outcome).toBe('APPLIED') });
capture('inspection', {
  act: (h) => {
    const runtime = h.ready();
    const request = mapProjectionRequest(runtime.store.getState());
    if (request === null) throw new Error('no viewpoint');
    const context = mapInspectionContext(runtime.bundle.projection.lookup(request.sessionId, request.tc, request.depth), request);
    if (!context.ok) throw new Error('no inspection context');
    expect(inspectObject(runtime.store, context.context, { family: 'THREAD', id: 'thread-b' }).outcome).toBe('APPLIED');
  },
});
capture('stale-projection', {
  withhold: ['THREAD'],
  act: (h) => expect(zoomSemanticStep(h.ready().store, 'IN').outcome).toBe('APPLIED'),
});

capture('increased-contrast', {
  before: () => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(true);
  },
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  for (const h of harnesses.splice(0)) h.dispose();
});

describe('S5-03B R1 — the Living Analysis screen is exactly what it was before the screen extraction', () => {
  const recorded: Record<string, unknown> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
  const produced: Record<string, unknown> = {};

  it.each(Object.keys(cases))('%s', async (name) => {
    produced[name] = JSON.parse(JSON.stringify(await cases[name]()));
    if (WRITE) return;
    expect(recorded[name]).toBeDefined();
    expect(produced[name]).toEqual(recorded[name]);
  });

  it('covers every case of the golden, and the golden covers every case', () => {
    if (WRITE) {
      mkdirSync(join(__dirname, '__golden__'), { recursive: true });
      writeFileSync(GOLDEN, `${JSON.stringify(produced, null, 1)}\n`);
      return;
    }
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(cases).sort());
  });

  it('every case records a distinct screen (each state is really reached)', () => {
    const seen = new Map<string, string>();
    for (const [name, tree] of Object.entries(WRITE ? produced : recorded)) {
      const key = JSON.stringify(tree);
      expect(seen.get(key)).toBeUndefined();
      seen.set(key, name);
    }
  });
});
