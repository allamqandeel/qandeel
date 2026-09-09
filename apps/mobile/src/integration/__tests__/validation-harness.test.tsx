/**
 * T-12 Phase M — the `QAN-BL-T12-04` harness, checked for the two properties that would hurt.
 *
 * The harness exists to run on a device, so almost nothing about its OUTCOME can be proven here — the
 * whole reason the item is open is that `expo-sqlite` has no implementation under `jest-expo`. What
 * CAN be proven, and matters most, is that it is safe and inert: it renders nothing that leaks a
 * credential, and it is unreachable from the Product route.
 *
 * The reachability proof that actually binds is the transitive import-closure walk in the root static
 * contract. This file proves the runtime half: the Product route renders no part of it.
 */
import { render } from '@testing-library/react-native';

import IndexRoute from '../../app/index';
import { PRODUCT_ROOT_TEST_ID } from '../composition/ProductRoot';
import { AuthStorageValidationHarness, VALIDATION_HARNESS_TEST_ID } from '../__validation__/AuthStorageValidationHarness';

describe('Phase M — the validation harness is isolated from the Product', () => {
  it('the Product route renders no part of the harness', async () => {
    const view = await render(<IndexRoute />);
    expect(view.getByTestId(PRODUCT_ROOT_TEST_ID)).toBeTruthy();
    expect(view.queryByTestId(VALIDATION_HARNESS_TEST_ID)).toBeNull();
    // Not by test id, and not by any of its controls either.
    for (const control of ['t1204-email', 't1204-password', 't1204-run-BEFORE_RESTART', 't1204-report']) {
      expect(view.queryByTestId(control)).toBeNull();
    }
    view.unmount();
  });

  it('the harness starts empty: no credential default, and nothing prefilled', async () => {
    const view = await render(<AuthStorageValidationHarness />);
    for (const field of ['t1204-email', 't1204-password', 't1204-second-email', 't1204-second-password']) {
      expect(view.getByTestId(field).props.value).toBe('');
      // A placeholder is a credential-shaped hint on screen and in every screenshot of it.
      expect(view.getByTestId(field).props.placeholder).toBeUndefined();
    }
    view.unmount();
  });

  it('both password fields are masked, so a screenshot of a run is safe evidence', async () => {
    const view = await render(<AuthStorageValidationHarness />);
    expect(view.getByTestId('t1204-password').props.secureTextEntry).toBe(true);
    expect(view.getByTestId('t1204-second-password').props.secureTextEntry).toBe(true);
    view.unmount();
  });

  it('it renders no report until a run produces one, so there is nothing to misread as a result', async () => {
    const view = await render(<AuthStorageValidationHarness />);
    expect(view.queryByTestId('t1204-report')).toBeNull();
    // And it says plainly what it is, so a screenshot cannot be mistaken for a Product screen.
    expect(JSON.stringify(view.toJSON())).toContain('NOT PRODUCT');
    view.unmount();
  });

  it('the harness carries no Product copy, no Product language and no visual language', async () => {
    const view = await render(<AuthStorageValidationHarness />);
    const tree = JSON.stringify(view.toJSON());
    for (const product of ['Moment', 'Thread', 'Reading', 'Live edge', 'conversation', 'Qandeel', 'QANDEEL —']) {
      expect(tree).not.toContain(product);
    }
    // No colour: it defines no palette and cannot be read as a first draft of a sign-in design.
    expect(tree).not.toMatch(/#[0-9a-fA-F]{6}|rgba?\(/u);
    view.unmount();
  });
});
