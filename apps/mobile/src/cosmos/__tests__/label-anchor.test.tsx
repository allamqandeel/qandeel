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
import { CosmosCanvas, labelBodyAt, placeLabels, type CosmosCanvasHandle } from '../skia/CosmosCanvas';

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

// COSMOS E-2 final corrections (PO directive "COSMOS E-2 Final Corrections, Emulator Validation & GitHub CI
// Authorization", 2026-11-21). History: the HONOR pass found Personal topic names overprinting (DEFECT-3); a canvas gate
// (aa3989a0) and a middle size (a243a9d8) answered it, and the PO then decided that Personal names speak PUBLIC's label
// language. So: an unselected topic is an ordinary label in its body's hue at Public's ordinary size, the selected topic is
// the bright title (§2, a stage amendment; the canvas's R1 / R3 rules are withdrawn, restoring its frozen rules); a name
// near an edge is shortened to the room it has instead of left out (§3, Personal only); no label is laid across the host's
// bottom rail (§6); and a tap inside a drawn Personal name is that name's body's tap (§4).
describe("COSMOS E-2 final corrections — Personal topic names in Public's label language, discoverable, tappable", () => {
  const thread = (id: string, x: number, y: number, name: string, dye: 0 | 1 | 2 | 3 = 2) => ({ id, kind: 'THREAD' as const, x, y, dye, label: name, fromRung: 0 });
  const TOPICS = [
    thread('wedding', 0, 0, "My brother's wedding is in March"),
    thread('mother', 30, 0, "My mother's tests came back", 3),
    thread('alexandria', 0, 220, 'There is a job in Alexandria'),
    // Near the left edge, overlapping nothing.
    thread('karim', 60 - W / 2, -220, 'Karim asked if we should move in', 1),
  ];
  const personal = (focusId: string | null) => compileStage({ world: 'PERSONAL', rungs: 5, focusId, rtl: false, entities: TOPICS }).layers.find((l) => l.rung === 0)!;
  const placedAt = (focusId: string | null) => placeLabels(personal(focusId).labels, 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { fit: true });
  const overlapping = (placed: ReturnType<typeof placeLabels>) => placed.some((a, i) => placed.some((b, j) => {
    if (j <= i) return false;
    const [a0, a1, a2, a3] = a.box; const [b0, b1, b2, b3] = b.box;
    return a0 < b2 && a2 > b0 && a1 < b3 && a3 > b1;
  }));
  // Public: at MID an unselected place is an ordinary label in its body's hue; at NEAR the selected one is the bright title.
  const publicLabel = (dye: 0 | 1 | 2 | 3, focusId: string | null) => {
    const stage = compileStage({ world: 'PUBLIC', rungs: 3, focusId, rtl: false, entities: [{ id: 'p', kind: 'PLACE', x: 0, y: 0, dye, label: 'A place in Public', fromRung: 0 }] });
    const rung = focusId === null ? 1 : 2;
    const layer = stage.layers.find((l) => l.rung === rung)!;
    return placeLabels(layer.labels, rung, rungScale(rung), HOME, W, H, FOCUS_Y, 1, false)[0]!;
  };

  it("§2 typography and colour: an unselected topic name has Public's ordinary size and role, in its own body's colour", () => {
    const placed = placedAt(null);
    const wedding = placed.find((p) => p.id === 'wedding')!;
    expect(wedding.major).toBe(false);
    expect(wedding.size).toBe(publicLabel(2, null).size);
    expect(wedding.color).toBe(publicLabel(2, null).color);
    // Each name takes ITS body's dye: topics of different dyes do not share a colour.
    const karim = placed.find((p) => p.id === 'karim')!;
    expect(karim.color).toBe(publicLabel(1, null).color);
    expect(karim.color).not.toBe(wedding.color);
  });

  it("§2 selection: the selected topic is the bright title, exactly as Public's selected subject, and stays distinct", () => {
    const placed = placedAt('mother');
    const mother = placed.find((p) => p.id === 'mother')!;
    expect(mother).toMatchObject({ major: true, color: '#FFFFFF' });
    expect(mother.size).toBe(publicLabel(3, 'p').size);
    expect(placed.filter((p) => p.id !== 'mother').every((p) => !p.major && p.size < mother.size)).toBe(true);
    // The binding follows the entity: unselected, the same topic is in its body's hue again (Public's own colour for dye 3).
    const stage = compileStage({ world: 'PERSONAL', rungs: 5, focusId: null, rtl: false, entities: [thread('mother', 0, 0, "My mother's tests came back", 3)] });
    const alone = placeLabels(stage.layers[0]!.labels, 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { fit: true })[0]!;
    expect(alone.color).toBe(publicLabel(3, null).color);
  });

  it('§3 no overprint, and a name near the edge is shortened on its body instead of left out (Personal only)', () => {
    const placed = placedAt(null);
    expect(overlapping(placed)).toBe(false);
    const karim = placed.find((p) => p.id === 'karim');
    expect(karim).toBeDefined();
    expect(karim!.text.endsWith('…')).toBe(true);
    expect(karim!.text.length).toBeGreaterThanOrEqual(10);
    expect('Karim asked if we should move in'.startsWith(karim!.text.slice(0, -1))).toBe(true);
    expect(Math.abs(karim!.left + LABEL_WIDTH / 2 - 60)).toBeLessThanOrEqual(16);
    // Without the Personal fit (Shared / Public), the same label keeps the frozen rule: left out.
    const frozen = placeLabels(personal(null).labels, 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false);
    expect(frozen.map((p) => p.id)).not.toContain('karim');
  });

  it("§3 the selected topic's title is drawn first and whole; a neighbour under it is left out, never printed over it", () => {
    const placed = placedAt('mother');
    expect(placed[0]).toMatchObject({ id: 'mother', major: true });
    expect(placed.map((p) => p.id)).not.toContain('wedding');
    expect(overlapping(placed)).toBe(false);
  });

  it('§6 no label is laid across the host rail: a label reaching the floor is left out; above it, it stays', () => {
    const at = (y: number) => [{ ...label('low', 0, false), y }];
    expect(placeLabels(at(300), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false)).toHaveLength(1);
    expect(placeLabels(at(300), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FOCUS_Y + 300 + 10 })).toEqual([]);
    expect(placeLabels(at(300), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FOCUS_Y + 300 + 40 })).toHaveLength(1);
  });

  describe('narrow-screen selected title (PO directive "COMPLETE ALL CORRECTIONS BEFORE FINAL CI", 2026-11-21)', () => {
    // A major (selected) title at rung 0, k = 1: size 23, so its drawn height is 23 + 5 = 28 pt.
    const titleAt = (y: number, major: boolean) => [{ ...label(major ? 'selected' : 'other', 0, major, 'Mother'), y }];
    const FLOOR = FOCUS_Y + 300 + 10;
    const lowest = FLOOR - 23 - 5;

    it('the selected Personal title reaching the floor is lifted by exactly the shortfall, and stays centred on its body', () => {
      const placed = placeLabels(titleAt(300, true), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR, fit: true });
      expect(placed).toHaveLength(1);
      expect(placed[0]).toMatchObject({ id: 'selected', major: true, text: 'Mother', top: lowest });
      expect(placed[0]!.box[3]).toBeLessThanOrEqual(FLOOR);
      expect(placed[0]!.left + LABEL_WIDTH / 2).toBe(W / 2);
    });

    it('a selected title already above the floor is not moved', () => {
      const placed = placeLabels(titleAt(200, true), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR, fit: true });
      expect(placed[0]!.top).toBe(FOCUS_Y + 200);
    });

    it('an unselected label at the floor is still left out, in the Personal world too', () => {
      expect(placeLabels(titleAt(300, false), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR, fit: true })).toEqual([]);
    });

    it('Shared and Public (no `fit`) keep the frozen rule: the selected title at the floor is left out', () => {
      expect(placeLabels(titleAt(300, true), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR })).toEqual([]);
    });

    it('a body too far below the floor (more than two title heights) is never drawn away from: its title is left out', () => {
      expect(placeLabels(titleAt(300 + 2 * 28 + 1, true), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR + 2 * 28 + 1, fit: true })).toHaveLength(1);
      expect(placeLabels(titleAt(300 + 2 * 28 + 1, true), 0, rungScale(0), HOME, W, H, FOCUS_Y, 1, false, { floor: FLOOR, fit: true })).toEqual([]);
    });
  });

  it('§4 a tap inside a drawn name resolves to its own body; a body, empty space and a name without a hit do not', () => {
    const layer = personal(null);
    const layout = { rung: 0, scale: rungScale(0), labels: placedAt(null) };
    const wedding = layout.labels.find((p) => p.id === 'wedding')!;
    // The world point under the middle of the drawn name (the layout's camera is HOME at scale 1).
    const [l, t, r, b] = wedding.box;
    const tx = (l + r) / 2 - W / 2; const ty = (t + b) / 2 - FOCUS_Y;
    expect(labelBodyAt(layout, HOME, FOCUS_Y, W, layer.hits, 1, tx, ty)).toBe('wedding');
    // On a body: the body's own tap, never re-aimed.
    expect(labelBodyAt(layout, HOME, FOCUS_Y, W, layer.hits, 1, 0, 0)).toBeNull();
    // Empty space, far from every name and body.
    expect(labelBodyAt(layout, HOME, FOCUS_Y, W, layer.hits, 1, 150, -350)).toBeNull();
    // A drawn name whose body is not a hit of this rung resolves to nothing.
    expect(labelBodyAt(layout, HOME, FOCUS_Y, W, layer.hits.filter((h) => h.id !== 'wedding'), 1, tx, ty)).toBeNull();
  });

  it('Shared and Public are untouched: every major label there is the selected subject, and only Personal fits and routes', () => {
    const place = (id: string, x: number) => ({ id, kind: 'PLACE' as const, x, y: 0, dye: 1 as const, label: id, fromRung: 0 });
    for (const world of ['SHARED', 'PUBLIC'] as const) {
      const stage = compileStage({ world, rungs: 3, focusId: 'b', rtl: false, entities: [place('a', 0), place('b', 30), { ...place('c', 60), kind: 'EXPERIENCE' as const }] });
      for (const layer of stage.layers) for (const l of layer.labels) if (l.major) expect(l.emphasis).toBe(true);
    }
    const source = readFileSync(join(__dirname, '..', 'skia', 'CosmosCanvas.tsx'), 'utf8');
    expect(source).toMatch(/fit: world === 'PERSONAL'/u);
    expect(source).toMatch(/props\.world === 'PERSONAL' && route !== null/u);
  });
});
