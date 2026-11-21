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
 *
 * COSMOS-INT-01 Slice C — CONTROLLED RE-ANCHOR (Product Owner, 2026-11-15; Contract v1.3 §14 C-1…C-6, §15.5): the Personal
 * screen is the approved COSMOS experience. The Timeline row and the T-08 chrome band are no longer composed — the stage
 * occupies their area — and the same functions are the stage's rail (T-05 / T-06 with the T-08 temporal line) and its
 * compact contextual controls (T-07 acts, T-04's context choice). The golden was regenerated ONCE for that change, which
 * is an intended change of the screen, not a refactor. The screen is measured as the device measures it: the surface's
 * chrome band reports its (empty) content height, so the band is the bottom safe area and nothing else (C-6).
 *
 * UI-POLISH-01 — CONTROLLED RE-ANCHOR (Product Owner, 2026-11-16, "App-Wide Typography & Premium UI Refinement"; the
 * refined running-text roles in conversation/visual/theme.ts): regenerated ONCE because the type roles were intentionally
 * refined. Before it was rewritten, a structural diff of the old and new golden proved that the host tree is identical.
 * That covers keys, array lengths, order, testIDs, handlers, accessibility and every non-type value. The ONLY differing
 * leaves are 26 `fontSize` and 107 `lineHeight` values, each exactly a role's refinement: supporting 15 / 25 → 14 / 22
 * (26 × 2), action 23 → 22 (41) and metadata 20 → 18 (40). The protection is unchanged: the screen is exactly the
 * composition it was, now drawn at the refined roles.
 *
 * COSMOS-INT-01 Slice D CP3 — CONTROLLED RE-ANCHOR (Product Owner, 2026-11-17; Contract v1.7 §19.16): the Personal stage
 * now holds CP1's Detail Sheet (PEEK only). The golden was regenerated ONCE for that intended change. Before it was
 * rewritten, a structural diff proved that in EVERY one of the 13 cases the new tree equals the old one exactly once three
 * CP3 additions are taken out — the sheet stage wrapper (`cosmos-detail-sheet-stage`, unwrapped), the rail's holder
 * (`qandeel-personal-rail-holder`, unwrapped) and the sheet's frame (removed) — and that the PEEK's content is present in
 * the `inspection` case only. Nothing else of the screen moved: world, rail, acts, testIDs, handlers and accessibility.
 *
 * COSMOS-INT-01 Slice E D-1 — CONTROLLED RE-ANCHOR (Product Owner, 2026-11-18; Contract §21): on iOS the depth rail's
 * stretched beads stood over the stage and took its touches. Two touch / layout properties of the rail's beads were
 * changed, and nothing else. The golden was regenerated ONCE for them. Before it was rewritten, a structural comparison
 * (apps/mobile/scripts/golden-structural-diff.mjs, old sha256 bfad7d3c…, new 34488cd3…) proved:
 *   - no structural difference in any of the 13 cases: no host element added or removed, no type, order or child count
 *     changed;
 *   - exactly 78 differing leaves, 6 per case, each on a depth-rail bead and each on the allow-list:
 *     - 65 `alignSelf: 'flex-end'` added to a bead's style. The bead is as wide as what it draws; its content was already
 *       right-aligned, so nothing drawn moves.
 *     - 13 `pointerEvents: 'none'` added to the selected (current, disabled) bead, one per case.
 *   - every other bead is byte-identical to the recording (no pointerEvents of its own).
 * Handlers, testIDs, accessibility (roles, labels, states) and every other value are unchanged.
 *
 * COSMOS-INT-01 Slice E D-3 — CONTROLLED RE-ANCHOR (Product Owner, 2026-11-18; Contract §24 – §25): SE-FU-2, E-1 option
 * (a) and the rail below the top controls changed touch, accessibility and layout properties of the stage's chrome, and
 * nothing else. The golden was regenerated ONCE for them. Before it was rewritten, the same structural comparison (its
 * allow-list extended for D-3; old sha256 34488cd3…, new ddf12cfa…) proved:
 *   - no structural difference in any of the 13 cases;
 *   - exactly 155 differing leaves (12 per case, 11 in stale-projection), each on the allow-list:
 *     - 51 BEAD_TOUCH: `pointerEvents: 'none'` on every disabled (deeper) bead, as on the current one since D-1;
 *     - 26 RAIL_TOP: the rail's top moves from the style sheet's '36%' to the same 36 % as a number in its own style
 *       (the recorded window has no control reaching the rail, so the place is unchanged);
 *     - 13 RAIL_LINE: `pointerEvents: 'none'` on the rail's decorative line;
 *     - 46 BACK_HOME: Back at home takes no touch and is hidden from assistive technology on both platforms, and its
 *       style gains `flexShrink: 1`; 6 BACK_AWAY: away from home the same three properties at their defaults;
 *     - 13 OVERVIEW: the Overview chip's style gains `flexShrink: 0`;
 *   - every bead's touch follows whether it acts (65 beads, 0 inconsistent).
 * Handlers, testIDs, roles, labels, states, the artwork and every other value are unchanged.
 *
 * COSMOS E-2 corrections, Slice A — CONTROLLED RE-ANCHOR (Product Owner decisions D-3 / D-4 of 2026-11-20; Contract §31):
 * the Personal PEEK names the inspected Thread (the user's alias over the grounding wording, else "Unnamed topic") beneath the
 * family word, and offers Open where it began (and Name this topic where the composition can rename; this recording cannot,
 * so that chip is absent). The golden was regenerated ONCE for that intended change (old sha256 ddf12cfa…, new 136bc101…).
 * Before it was rewritten, a per-case comparison of the two recordings proved: 12 of the 13 cases are byte-identical; in
 * `inspection` the PEEK sits at the same path, everything outside the PEEK is byte-identical, and the PEEK gains exactly the
 * name line (`qandeel-personal-peek:name`) and the acts row (`:name-acts` holding `:source`): 7 → 12 host elements, the
 * three previous texts and testIDs unchanged and in the same order. The structural-diff script (which forbids added
 * elements by design) is therefore not the proof here; the added elements ARE the change.
 *
 * COSMOS E-2 corrections, Slice C — CONTROLLED RE-ANCHOR (Product Owner decision D-5, Option U, of 2026-11-20; Contract §31):
 * the Personal map gained its two mode chips ("This conversation" / "All my topics now") at the start of the rail; the map
 * opens in the Session-bound mode, so every recorded case is that mode with the chips added and nothing else. The golden was
 * regenerated ONCE for that intended change (old sha256 136bc101…, new 733a298f…). Before it was rewritten, a per-case
 * comparison proved: in EVERY one of the 13 cases the new tree equals the old one exactly once the ONE chips subtree
 * (`qandeel-personal-world-mode`, 7 host elements: two buttons, the Session one selected) is taken out; keys, order, texts,
 * testIDs, handlers and accessibility of everything else are byte-identical. The CURRENT mode is not recorded here (it is
 * proven by personal-current-world.test.tsx), so the Session-bound screen stays the one this golden protects.
 *
 * COSMOS E-2 HONOR acceptance DEFECT-4 — CONTROLLED RE-ANCHOR (Product Owner decision of 2026-11-20): the Personal PEEK's
 * scroller keeps handled taps, so Save in the topic-name editor works while the keyboard is open. The golden was
 * regenerated ONCE for that intended change (old sha256 733a298f…, new 626e6bce…). Before it was committed, the diff of the
 * two recordings was exactly ONE added line, `"keyboardShouldPersistTaps": "handled"` on the PEEK's scroller in the
 * `inspection` case; every other case and value is byte-identical.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { inspectObject, mapInspectionContext, mapProjectionRequest, panByTranslation, zoomSemanticStep } from '../../map';
import type { HistoricalSemanticDepth } from '../../projection';
import { RESPONSIVE_CHROME_MEASURE_TEST_ID } from '../../responsive';
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
  // Slice C: the chrome band measures its content, as on the device; the Personal composition brings none.
  await fireEvent(view.getByTestId(RESPONSIVE_CHROME_MEASURE_TEST_ID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 0 } } });
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

  /**
   * Slice C (§15.6, for Product Owner review): the Personal screen's visible chrome is the approved COSMOS palette and does not
   * vary with the platform's increased-contrast setting. Before Slice C the ONLY difference increased contrast made to this
   * screen was the old Timeline row's position-rail border (one ink token), and that row is no longer composed; the headless
   * navigators keep the Analysis ink hook. The case is kept — it records the screen under the setting — and the one pair it
   * now coincides with is named here rather than hidden.
   */
  const KNOWN_IDENTICAL: readonly (readonly [string, string])[] = [['en-compact-following-live', 'increased-contrast']];

  it('every case records a distinct screen (each state is really reached), except the one named pair', () => {
    const seen = new Map<string, string>();
    for (const [name, tree] of Object.entries(WRITE ? produced : recorded)) {
      const key = JSON.stringify(tree);
      const earlier = seen.get(key);
      if (earlier !== undefined) {
        expect(KNOWN_IDENTICAL).toContainEqual([earlier, name]);
        continue;
      }
      seen.set(key, name);
    }
  });
});
