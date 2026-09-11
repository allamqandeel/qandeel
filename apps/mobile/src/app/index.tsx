import { ProductRoot } from '../integration';

/**
 * The only route, and it now renders the Product (T-12, `QAN-BL-T12-03`).
 *
 * There is still exactly one, and there will be: QANDEEL navigation is canonical-state navigation,
 * not a route stack. World, Thread, Reading, Return, a Timeline position and an inspection depth are
 * canonical state, and none of them is a page.
 */
export default function IndexRoute() {
  return <ProductRoot />;
}
