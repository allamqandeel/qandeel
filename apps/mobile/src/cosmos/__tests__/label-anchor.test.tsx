// COSMOS E-2 corrections, Slice D-1 (PO directive 2026-11-20 §7) — a label stays on its body.
//
// Two renderer-local rules, proven here:
//   1. `placeLabels`: an ordinary label near a side of the glass is moved inward by at most LABEL_EDGE_SHIFT_MAX (16 pt)
//      to be drawn whole; one that would need more is left out, never drawn away from its body. The hub's title (the
//      selected subject) keeps the full inward move, so it is drawn whole wherever its body is in view.
//   2. The layout anchor is the camera a settle is AIMED at, taken when it is aimed (`anchorTo` in `settle` / `jump`),
//      not when it completes: a label never waits for an uninterrupted 320 ms rest to be laid out where its body is.
//      Headless, every animation lands at once, so the aim-time rule is pinned on the source and its effect (the laid
//      positions follow the aimed camera) on the rendered tree.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { createRef } from 'react';
import { StyleSheet } from 'react-native';

import { compileStage, rungScale, type StageLabel } from '../core/stage';
import { CosmosCanvas, placeLabels, type CosmosCanvasHandle } from '../skia/CosmosCanvas';

jest.mock('@shopify/react-native-skia', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const element = (name: string) => {
    const Component = ({ children }: { children?: unknown }) => React.createElement(View, { skiaElement: name } as object, (children ?? null) as never);
    Component.displayName = name;
    return Component;
  };
  const disposable = () => ({ dispose: () => undefined });
  const builder = () => { const b: Record<string, unknown> = { build: disposable, dispose: () => undefined }; for (const m of ['moveTo', 'lineTo', 'close']) b[m] = () => b; return b; };
  const image = { width: () => 1024, height: () => 1024, dispose: () => undefined };
  return {
    Canvas: element('Canvas'), Fill: element('Fill'), Group: element('Group'), Path: element('Path'), Rect: element('Rect'), RadialGradient: element('RadialGradient'),
    LinearGradient: element('LinearGradient'), ImageShader: element('ImageShader'), Atlas: element('Atlas'),
    FilterMode: { Nearest: 0, Linear: 1 }, MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
    useImage: () => image,
    Skia: { XYWHRect: disposable, RSXform: disposable, PathBuilder: { Make: builder } },
  };
});
beforeAll(() => {
  const reanimated = jest.requireMock<{ useSharedValue: <T>(initial: T) => { get(): T; set(next: T): void; modify?: (fn: (value: T) => T) => void } }>('react-native-reanimated');
  const boxed = reanimated.useSharedValue;
  reanimated.useSharedValue = <T,>(initial: T) => { const box = boxed(initial); box.modify ??= (fn) => box.set(fn(box.get())); return box; };
});

const W = 390; const H = 844; const FOCUS_Y = H / 2;
const HOME = { cx: 0, cy: 0, scale: 1 };
const LABEL_WIDTH = 240;
const label = (id: string, x: number, major: boolean, text = 'A long enough label here'): StageLabel => ({ id, text, x, y: 0, emphasis: major, major, tint: -1 });

describe('Slice D-1 — placeLabels keeps an ordinary label on its body near the glass edge', () => {
  // rung 0 at its own scale (k = 1): an ordinary 24-character label estimates 24 × 12.5 × 0.58 + 8 = 182 pt wide; drawn
  // whole it needs its centre at ≥ 101 pt from the left (half width + the 10 pt rail).
  const place = (labels: StageLabel[]) => placeLabels(labels, 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false);
  const px = (x: number) => x + W / 2;

  it('a label that would need more than 16 pt of inward shift is left out, not displaced', () => {
    expect(place([label('a', 60 - W / 2, false)])).toEqual([]);
  });

  it('a label within the 16 pt allowance is drawn whole, moved by that little', () => {
    const placed = place([label('b', 90 - W / 2, false)]);
    expect(placed).toHaveLength(1);
    expect(placed[0].left + LABEL_WIDTH / 2).toBe(101);
    expect(Math.abs(placed[0].left + LABEL_WIDTH / 2 - px(90 - W / 2))).toBeLessThanOrEqual(16);
  });

  it('a label away from the edges is centred exactly on its body', () => {
    const placed = place([label('c', 0, false)]);
    expect(placed).toHaveLength(1);
    expect(placed[0].left + LABEL_WIDTH / 2).toBe(px(0));
  });

  it("the hub's title (the selected subject) keeps the full inward move and is drawn whole", () => {
    const placed = place([label('hub', 60 - W / 2, true)]);
    expect(placed).toHaveLength(1);
    expect(placed[0].major).toBe(true);
    expect(placed[0].left + LABEL_WIDTH / 2).toBe(130);
  });

  it('the 24 pt edge rule and the top / bottom bands still leave labels out', () => {
    expect(place([label('edge', 20 - W / 2, false)])).toEqual([]);
    expect(placeLabels([{ ...label('band', 0, false), y: 60 - FOCUS_Y }], 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false)).toEqual([]);
  });
});

describe('Slice D-1 — the layout anchor is the camera a settle is aimed at', () => {
  const STAGE = compileStage({
    world: 'PUBLIC', rungs: 3, focusId: null, rtl: false,
    entities: [{ id: 'e1', kind: 'EXPERIENCE', x: 0, y: 0, dye: 0, label: 'Walking home', fromRung: 0 }],
  });
  let view: RenderResult | null = null;
  const handle = createRef<CosmosCanvasHandle>();
  const mount = async () => {
    view = await render(
      <CosmosCanvas
        ref={handle} world="PUBLIC" stage={STAGE} held={null} rung={1} rtl={false} initialCamera={HOME} mode="FULL" drift={false}
        onPanEnd={() => undefined} onPinchEnd={() => undefined} onTap={() => undefined} onSettled={() => undefined}
        accessibilityLabel="The world · test" zoomInLabel="in" zoomOutLabel="out" onZoomIn={() => undefined} onZoomOut={() => undefined}
        labelOf={() => ''} onActivate={() => undefined}
      />,
    );
    await act(async () => { fireEvent(view!.getByLabelText('The world · test'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: W, height: H } } }); });
  };
  afterEach(async () => { await cleanup(); view = null; });
  /** The laid-out centres (points from the left of the glass) of the entity's label on every rung that names it. */
  const laidCentres = () => view!.getAllByText('Walking home').map((text) => {
    const box = StyleSheet.flatten(text.parent!.props.style as object) as { left: number };
    return box.left + LABEL_WIDTH / 2;
  });

  it('after a settle is aimed, the MID label is laid out around the aimed camera (its body at rung scale)', async () => {
    await mount();
    expect(new Set(laidCentres())).toEqual(new Set([W / 2]));
    await act(async () => { handle.current!.settleTo({ cx: 10, cy: 0, scale: 1 }, FOCUS_Y); });
    const centres = laidCentres();
    expect(centres).toContain(W / 2 - 10 * rungScale(1));
    expect(centres).not.toContain(W / 2);
  });

  it('the source takes the anchor when the settle or the jump is aimed, never on completion', () => {
    const source = readFileSync(join(__dirname, '..', 'skia', 'CosmosCanvas.tsx'), 'utf8');
    const emitSettled = source.slice(source.indexOf('const emitSettled = useCallback('), source.indexOf('// ── settle and jump'));
    expect(emitSettled).not.toMatch(/setSettled|anchorTo/u);
    expect(source.match(/host\.aim\(to, focusY, (?:true|false)\);\s*\n\s*anchorTo\(to, focusY\);/gu)).toHaveLength(2);
  });
});

// COSMOS E-2 HONOR acceptance (PO decision 2026-11-20, DEFECT-3): at THE WHOLE WORLD every Personal topic name was a
// major title, which skips the overlap gate, so neighbouring names printed over each other. The amended stage keeps the
// SELECTED topic's large title and makes every other name an ordinary label in its body's hue.
describe('COSMOS E-2 DEFECT-3 — Personal topic names never print over each other', () => {
  const thread = (id: string, x: number, y: number, name: string) => ({ id, kind: 'THREAD' as const, x, y, dye: 2 as const, label: name, fromRung: 0 });
  const TOPICS = [
    thread('wedding', 0, 0, "My brother's wedding is in March"),
    thread('mother', 30, 0, "My mother's tests came back"),
    thread('alexandria', 0, 220, 'There is a job in Alexandria'),
  ];
  const placedAt = (focusId: string | null) => {
    const stage = compileStage({ world: 'PERSONAL', rungs: 5, focusId, rtl: false, entities: TOPICS });
    const layer = stage.layers.find((l) => l.rung === 0)!;
    return { layer, placed: placeLabels(layer.labels, 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false) };
  };
  const boxesOverlap = (placed: ReturnType<typeof placeLabels>) => placed.some((a, i) => placed.some((b, j) => j > i
    && Math.abs(a.left - b.left) < (a.text.length + b.text.length) * 0.58 * Math.max(a.size, b.size) / 2 && Math.abs(a.top - b.top) < Math.max(a.size, b.size) + 4));

  it('with nothing selected: no topic name is a major title, the two neighbours do not overprint, the distant one stays', () => {
    const { layer, placed } = placedAt(null);
    expect(layer.labels.every((l) => !l.major && l.tint === 2)).toBe(true);
    expect(placed.map((p) => p.id).sort()).toEqual(['alexandria', 'wedding']);
    expect(boxesOverlap(placed)).toBe(false);
  });

  it("the selected topic keeps its large title, drawn first; a neighbour under it is left out, not printed over it", () => {
    const { layer, placed } = placedAt('mother');
    expect(layer.labels.find((l) => l.id === 'mother')).toMatchObject({ major: true, emphasis: true, tint: -1 });
    expect(placed[0]).toMatchObject({ id: 'mother', major: true });
    expect(placed.map((p) => p.id)).not.toContain('wedding');
    expect(placed.map((p) => p.id)).toContain('alexandria');
  });
});
