/**
 * MAP-CLOSE-01 O-2 (Product Owner, 2026-11-14): "Back One Step" must work when pressed again and again.
 *
 * Diagnosis on the PO's phone: Back itself worked every time. After the first Back the time is PINNED (by contract, Back
 * restores the captured position), so Go Live + Locate is offered and its line appeared BELOW the pair; the band grows
 * upward, so the pair, and Back with it, rose by one line, and the second press at the same place landed on Go Live +
 * Locate instead. CA-O2 (approved with conditions): the lines stack up from the bottom, the first lowest, so an act that
 * appears is added above; the band keeping its END in view when it overflows is tested in responsive-chrome-anchor-end.
 *
 * COSMOS-INT-01 D-1 (Product Owner, 2026-11-15): ported onto main's two arrangements. The STACKED column runs bottom-up
 * (`column-reverse`); the PAIRED row wraps bottom-up (`wrap-reverse`). The reading order is the frozen one either way.
 */
import { render } from '@testing-library/react-native';
import { StyleSheet, type View } from 'react-native';

import type { ReturnSurface } from '../../return-navigation';
import { RETURN_CONTROLS_TEST_ID, ReturnControls } from '../ReturnControls';
import { returnMeaning } from '../return-orientation';
import type { ReturnOpportunityId } from '../types';

const surface = {} as ReturnSurface;
const offered = (...ids: ReturnOpportunityId[]) => ({ offered: ids.map(returnMeaning), checkpointCount: 2 });

// The acts, in the order the tree holds them (the reading order).
const ids = (view: Awaited<ReturnType<typeof render>>) =>
  view.getAllByTestId(new RegExp(`^${RETURN_CONTROLS_TEST_ID}:`, 'u'))
    .map((node) => node.props.testID as string)
    .filter((id, index, all) => all.indexOf(id) === index);

describe('O-2 — Back stays under the finger when another act appears', () => {
  it.each([
    ['ar', 'STACKED', { flexDirection: 'column-reverse' }],
    ['en', 'STACKED', { flexDirection: 'column-reverse' }],
    ['ar', 'PAIRED', { flexDirection: 'row', flexWrap: 'wrap-reverse' }],
    ['en', 'PAIRED', { flexDirection: 'row', flexWrap: 'wrap-reverse' }],
  ] as const)('the first line is the lowest, so a line added later stands above it (%s, %s)', async (language, arrangement, expected) => {
    const props = { surface, language, arrangement, context: null };
    const before = await render(<ReturnControls {...props} orientation={offered('BACK_ONE_STEP', 'RETURN_WORLD')} />);
    const style = StyleSheet.flatten(before.getByTestId(RETURN_CONTROLS_TEST_ID).props.style) as View['props']['style'] & { flexDirection?: string; flexWrap?: string };
    expect(style).toMatchObject(expected);
    const after = await render(<ReturnControls {...props} orientation={offered('BACK_ONE_STEP', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE')} />);
    // The reading order is still the frozen one: Back first, the composite last.
    expect(ids(after)).toEqual([`${RETURN_CONTROLS_TEST_ID}:BACK_ONE_STEP`, `${RETURN_CONTROLS_TEST_ID}:RETURN_WORLD`, `${RETURN_CONTROLS_TEST_ID}:GO_LIVE_AND_LOCATE`]);
    // ...and the pair is the FIRST child of a bottom-up column: the composite's new line is laid out above it.
    expect(ids(before).slice(0, 2)).toEqual(ids(after).slice(0, 2));
  });
});
