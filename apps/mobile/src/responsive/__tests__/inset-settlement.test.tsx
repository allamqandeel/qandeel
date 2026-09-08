/**
 * T-11 R1 — the settled band follows the usable width, whatever moved it (T11-R1-01).
 *
 * The usable width has three independent authorities — the measured container width, the left inset
 * and the right inset — and only the first arrives as an event. When the band was settled inside
 * `onLayout`, an inset-only change recomposed the surface against a NEW usable width while the
 * stored band still described the OLD one, and hysteresis is path-dependent by construction: inside
 * the dead zone the band is decided by history rather than by the width, so a wrong predecessor is a
 * wrong band.
 *
 * Every test here drives the REAL hook through the REAL component. `onLayout` is fired exactly once,
 * at the start; every step after it changes props and nothing else, which is precisely the authority
 * the old settlement could not see.
 *
 * ## A note on the exact boundary, stated rather than buried
 *
 * `bandFor` holds EXPANSIVE while `usable >= EXPANSIVE_MIN_WIDTH - BAND_HYSTERESIS_POINTS`, so
 * `544` is the LAST expansive width and the dead zone is the half-open `[544, 552)`. That mirrors
 * the up-crossing, which is the closed `usable >= 552`, and it is what makes the hysteresis exactly
 * the 8-point rhythm it is documented as. A usable width of 544 therefore does NOT cross downward,
 * and the down-cross is proven at `536` instead — with `544` asserted explicitly below so the
 * boundary is recorded rather than assumed.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MAP_ACCESSIBILITY_TEST_ID, MAP_SURFACE_TEST_ID } from '../../map';
import { ORIENTATION_CHROME_TEST_ID, orientationModel, RETURN_CONTROLS_TEST_ID } from '../../orientation-chrome';
import { chromeStore, contextAt, readableText, TWO_CONTEXT_WORLD } from '../../orientation-chrome/__fixtures__/chrome';
import { sessionPosition } from '../../state';
import { createPresentationController } from '../../timeline';
import { createTemporalPreviewController } from '../../temporal-navigation/preview';
import { trackOf } from '../../temporal-navigation/__fixtures__/temporal';
import { isPressTarget, RESPONSIVE_MAP_FRAME_TEST_ID, ResponsiveWorld, subtree } from '../__fixtures__/composition';
import { BAND_HYSTERESIS_POINTS, EXPANSIVE_MIN_WIDTH, type PresentationBand, type RecompositionPlan } from '../plan';
import { RESPONSIVE_SURFACE_TEST_ID, ResponsiveSurface } from '../ResponsiveSurface';

jest.setTimeout(120_000);

const OUTER_WIDTH = 560;
const OUTER_HEIGHT = 900;
const DOWN_THRESHOLD = EXPANSIVE_MIN_WIDTH - BAND_HYSTERESIS_POINTS; // 544

/**
 * The real component, with the insets as the only thing a step is allowed to change.
 *
 * `onLayout` is fired ONCE. Everything afterwards is a prop change with no layout event behind it,
 * which is the authority the defect could not see.
 */
async function surface(initial: { readonly left: number; readonly right: number }) {
  const plans: RecompositionPlan[] = [];
  const view = await render(
    <ResponsiveSurface insets={initial}>
      {(plan) => {
        plans.push(plan);
        return <Text testID="band">{plan.band}</Text>;
      }}
    </ResponsiveSurface>,
  );
  await act(async () => {
    fireEvent(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: OUTER_WIDTH, height: OUTER_HEIGHT } },
    });
  });
  const insetsOnly = async (left: number, right: number) => {
    await act(async () => {
      view.rerender(
        <ResponsiveSurface insets={{ left, right }}>
          {(plan) => {
            plans.push(plan);
            return <Text testID="band">{plan.band}</Text>;
          }}
        </ResponsiveSurface>,
      );
    });
  };
  const band = (): PresentationBand => view.getByTestId('band').props.children as PresentationBand;
  const usable = (): number => {
    const plan = plans[plans.length - 1];
    return plan.surface.width - plan.surface.insetLeft - plan.surface.insetRight;
  };
  return { view, plans, insetsOnly, band, usable };
}

describe('T11-R1-01 — an inset-only change settles the band it actually composed', () => {
  it('R1-A01 — an inset-only step down through the boundary settles COMPACT', async () => {
    const s = await surface({ left: 0, right: 0 });
    expect(s.usable()).toBe(560);
    expect(s.band()).toBe('EXPANSIVE');

    // Props only. No outer layout event of any kind.
    await s.insetsOnly(12, 12);
    expect(s.usable()).toBe(536);
    expect(s.band()).toBe('COMPACT');

    await act(async () => {
      s.view.unmount();
    });
  });

  it('R1-A02 — the NEXT inset-only change uses the band that step settled, not the one before it', async () => {
    // This is the discriminating test. Before R1 the predecessor here was still the EXPANSIVE
    // settled at 560, whose down-threshold is 544, so 548 flipped back up. The band that actually
    // composed at 536 was COMPACT, whose up-threshold is 552, so 548 must stay COMPACT.
    const s = await surface({ left: 0, right: 0 });
    expect(s.band()).toBe('EXPANSIVE');
    await s.insetsOnly(12, 12);
    expect(s.band()).toBe('COMPACT');

    await s.insetsOnly(6, 6);
    expect(s.usable()).toBe(548);
    expect(s.band()).toBe('COMPACT');

    await act(async () => {
      s.view.unmount();
    });
  });

  it('R1-A03 — a true up-cross happens at the threshold, exactly once', async () => {
    const s = await surface({ left: 0, right: 0 });
    await s.insetsOnly(12, 12);
    await s.insetsOnly(6, 6);
    expect(s.band()).toBe('COMPACT');

    // 550: still inside the dead zone, still held COMPACT by its own up-threshold.
    await s.insetsOnly(5, 5);
    expect(s.usable()).toBe(550);
    expect(s.band()).toBe('COMPACT');

    await s.insetsOnly(4, 4);
    expect(s.usable()).toBe(EXPANSIVE_MIN_WIDTH);
    expect(s.band()).toBe('EXPANSIVE');

    // Exactly once: the crossing is not repeated by staying there.
    const crossings = s.plans.filter((plan, index) => index > 0 && plan.band !== s.plans[index - 1].band).length;
    expect(crossings).toBe(2); // down at 536, up at 552 — and nothing else
    await act(async () => {
      s.view.unmount();
    });
  });

  it('R1-A04 — the reverse, and repeated identical inset props do not oscillate', async () => {
    const s = await surface({ left: 4, right: 4 });
    expect(s.usable()).toBe(552);
    expect(s.band()).toBe('EXPANSIVE');

    // Inside the dead zone from above: held EXPANSIVE by the down-threshold.
    await s.insetsOnly(6, 6);
    expect(s.usable()).toBe(548);
    expect(s.band()).toBe('EXPANSIVE');

    // The same props again, five times. Nothing moves.
    for (let round = 0; round < 5; round += 1) {
      await s.insetsOnly(6, 6);
      expect(s.band()).toBe('EXPANSIVE');
    }
    const settledPlan = s.plans[s.plans.length - 1];
    await s.insetsOnly(6, 6);
    // Identity, not equality: an identical inset prop recomposes nothing at all.
    expect(s.plans[s.plans.length - 1]).toBe(settledPlan);

    // Below the frozen down threshold it becomes COMPACT.
    await s.insetsOnly(12, 12);
    expect(s.usable()).toBe(536);
    expect(s.band()).toBe('COMPACT');

    await act(async () => {
      s.view.unmount();
    });
  });

  it('the closed boundary is exactly where it is documented: 544 is the LAST expansive width', async () => {
    const s = await surface({ left: 0, right: 0 });
    expect(s.band()).toBe('EXPANSIVE');

    // 544 = 552 − 8. The dead zone is half-open `[544, 552)`, mirroring the closed up-crossing at
    // 552, which is what makes the hysteresis exactly the 8-point rhythm it is documented as.
    await s.insetsOnly(8, 8);
    expect(s.usable()).toBe(DOWN_THRESHOLD);
    expect(s.band()).toBe('EXPANSIVE');

    // One point below it, and it crosses.
    await s.insetsOnly(8, 9);
    expect(s.usable()).toBe(DOWN_THRESHOLD - 1);
    expect(s.band()).toBe('COMPACT');

    await act(async () => {
      s.view.unmount();
    });
  });

  it('a width change and an inset change reach the same composition from either direction', async () => {
    // The invariant is about the usable width, not about which authority moved it. 560 with 12+12
    // insets and 536 with none are the same composition, and must settle the same band.
    const viaInsets = await surface({ left: 0, right: 0 });
    await viaInsets.insetsOnly(12, 12);

    const plans: RecompositionPlan[] = [];
    const viaWidth = await render(
      <ResponsiveSurface insets={{ left: 0, right: 0 }}>
        {(plan) => {
          plans.push(plan);
          return <Text testID="band">{plan.band}</Text>;
        }}
      </ResponsiveSurface>,
    );
    await act(async () => {
      fireEvent(viaWidth.getByTestId(RESPONSIVE_SURFACE_TEST_ID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 536, height: OUTER_HEIGHT } },
      });
    });

    expect(viaInsets.band()).toBe('COMPACT');
    expect(plans[plans.length - 1].band).toBe('COMPACT');
    expect(plans[plans.length - 1].chrome.arrangement).toBe(viaInsets.plans[viaInsets.plans.length - 1].chrome.arrangement);

    await act(async () => {
      viaInsets.view.unmount();
    });
    await act(async () => {
      viaWidth.unmount();
    });
  });
});

describe('T11-R1-01 — R1-A05: an inset-only band change is still not a Product act', () => {
  it('writes nothing canonical, changes no semantic answer and remounts no world owner', async () => {
    const store = chromeStore({
      liveHead: 6,
      depth: 'ANALYTICAL_OBJECT',
      temporal: { kind: 'PINNED', at: sessionPosition(4) },
      liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' },
      liveFocusAtSp: 5,
    });
    const context = contextAt(TWO_CONTEXT_WORLD());
    const preview = createTemporalPreviewController();
    const presentation = createPresentationController(trackOf('session-1', 6), 0);
    const outcomes: unknown[] = [];
    const plans: RecompositionPlan[] = [];

    const world = (insets: { readonly left: number; readonly right: number }) => (
      <ResponsiveWorld
        store={store}
        context={context}
        language="ar"
        preview={preview}
        presentation={presentation}
        insets={insets}
        onMap={(outcome) => outcomes.push(outcome)}
        onTemporal={(outcome) => outcomes.push(outcome)}
        onPlan={(plan) => plans.push(plan)}
      />
    );

    const view = await render(world({ left: 0, right: 0 }));
    // The two INITIAL layouts, so the world exists at all: the outer surface, then the frame the
    // world is drawn in. Every step after this changes insets and nothing else — no further layout
    // event is fired anywhere, which is the authority the defect could not see.
    await act(async () => {
      fireEvent(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: OUTER_WIDTH, height: OUTER_HEIGHT } },
      });
    });
    await act(async () => {
      fireEvent(view.getByTestId(RESPONSIVE_MAP_FRAME_TEST_ID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: OUTER_WIDTH, height: Math.round(OUTER_HEIGHT / 2) } },
      });
    });

    const before = store.getState();
    const referenceModel = orientationModel(store, { held: true, context }, { liveContextAvailable: true });
    const words = readableText(view.getByTestId(ORIENTATION_CHROME_TEST_ID));
    const acts = subtree(view, RETURN_CONTROLS_TEST_ID)
      .filter(isPressTarget)
      .map((node) => ((node.props ?? {}) as Record<string, unknown>).testID);
    const mapSurface = view.getByTestId(MAP_SURFACE_TEST_ID);
    const accessibility = view.getByTestId(MAP_ACCESSIBILITY_TEST_ID);
    expect(plans[plans.length - 1].band).toBe('EXPANSIVE');

    // A full inset-only sweep across the boundary, in both directions, several times.
    for (const [left, right] of [
      [12, 12],
      [6, 6],
      [4, 4],
      [8, 8],
      [16, 16],
      [0, 0],
      [12, 12],
    ] as const) {
      await act(async () => {
        view.rerender(world({ left, right }));
      });
      // Identity, not equality: nothing canonical was written, so the store never published.
      expect(store.getState()).toBe(before);
      // The same answer, in the same words, with the same acts in the same order.
      expect(orientationModel(store, { held: true, context }, { liveContextAvailable: true })).toEqual(referenceModel);
      expect(readableText(view.getByTestId(ORIENTATION_CHROME_TEST_ID))).toEqual(words);
      expect(
        subtree(view, RETURN_CONTROLS_TEST_ID)
          .filter(isPressTarget)
          .map((node) => ((node.props ?? {}) as Record<string, unknown>).testID),
      ).toEqual(acts);
      // The world owner and its accessible layer are the same instances throughout: nothing was
      // keyed by a band, so no inset change can remount a world or duplicate an accessible route.
      expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBe(mapSurface);
      expect(view.getByTestId(MAP_ACCESSIBILITY_TEST_ID)).toBe(accessibility);
    }

    // The band really did move, so the sweep proved something.
    expect(new Set(plans.map((plan) => plan.band))).toEqual(new Set(['EXPANSIVE', 'COMPACT']));
    // No PAN, no ZOOM, no Return, no temporal act — none was attempted, so none was refused.
    expect(outcomes).toEqual([]);
    expect(before.history).toHaveLength(0);
    expect(before.temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(before.inspection).toBeNull();

    await act(async () => {
      view.unmount();
    });
  });
});
