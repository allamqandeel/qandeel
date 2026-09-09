/**
 * T-12 — A46, A55: the route output itself.
 *
 * This is what the release boot smoke actually sees, and under `jest-expo` it is also exactly what a
 * CI build sees: no Expo `extra` is present, so the public config is absent, `createIntegrationRuntime`
 * fails closed, and no runtime is built at all. That is the production path for an unconfigured
 * binary, and it is the one this file drives — nothing is injected, because the route component
 * deliberately offers no way to inject anything.
 */
import { render } from '@testing-library/react-native';

import IndexRoute from '../../app/index';
import { PRODUCT_ROOT_TEST_ID, ProductRoot, RUNTIME_STATE_TEST_ID } from '../composition/ProductRoot';

describe('T12-A46 — the route renders the integrated Product root', () => {
  it('the route output IS the integrated root, and the technical shell is nowhere in the tree', async () => {
    const view = await render(<IndexRoute />);
    expect(view.getByTestId(PRODUCT_ROOT_TEST_ID)).toBeTruthy();
    // T-01's shell had its own identifier and its own words. Neither is anywhere in this tree — it is
    // replaced, not hidden behind the new root.
    expect(view.queryByTestId('qandeel-foundation-shell')).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain('T-01 foundation shell');
    view.unmount();
  });

  it('with no public configuration it fails closed to a TECHNICAL state, and fabricates no Product', async () => {
    const view = await render(<ProductRoot />);
    // The root is present in this phase too, which is what makes the boot smoke honest: it proves the
    // app launched and the integrated root mounted, and claims nothing about a world.
    expect(view.getByTestId(PRODUCT_ROOT_TEST_ID)).toBeTruthy();
    const state = view.getByTestId(RUNTIME_STATE_TEST_ID);
    expect(state.props.children).toBeTruthy();

    // No Product surface, and no Product claim: a runtime that could not be built must not produce a
    // Session, a viewpoint, a world or an act to look at.
    const tree = JSON.stringify(view.toJSON());
    expect(tree).toContain('runtime: CONFIG_REFUSED');
    for (const surface of ['qandeel-map-surface', 'qandeel-orientation-chrome', 'qandeel-responsive-surface']) {
      expect(view.queryByTestId(surface)).toBeNull();
    }
    for (const productWord of ['Moment', 'Thread', 'Reading', 'Following the conversation', 'Looking at the whole world']) {
      expect(tree).not.toContain(productWord);
    }
    view.unmount();
  });

  it('T12-A55 — the root does not collapse its descendants into one accessibility node', async () => {
    const view = await render(<ProductRoot />);
    expect(view.getByTestId(PRODUCT_ROOT_TEST_ID).props.accessible).not.toBe(true);
    // The technical status announces itself politely rather than silently, and names itself in the
    // language it is actually written in.
    const state = view.getByTestId(RUNTIME_STATE_TEST_ID);
    expect(state.props.accessibilityLiveRegion).toBe('polite');
    expect(state.props.accessibilityLanguage).toBe('en');
    view.unmount();
  });

  it('the route component offers no injection seam a fixture could enter through', () => {
    // PM-05: a production route that accepts a config or an auth port is a way for a fixture Session
    // to reach the Product path while looking like ordinary composition.
    expect(ProductRoot.length).toBe(0);
  });
});
