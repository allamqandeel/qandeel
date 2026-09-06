/**
 * T-07 — `RETURN_WORLD`: return to the World / Z0 viewpoint, spatially and by depth only.
 *
 * Frozen result:
 *
 *     same TM, same effective TC, same K(TC), World/Z0 camera orientation
 *
 * The reader does not move in time and does not go Live. The inspection reference is NOT erased
 * merely because the World rung will withhold its render: `IF_ref` is the exact thing the reader
 * asked for, it survives the depth change, and whether it can be rendered at the World rung is
 * historical projection's answer, given afterwards.
 *
 * The camera it returns to is the existing canonical Map target and is never composed here: the
 * world origin, the canonical orientation, the default presentation scale, the `WORLD` rung and no
 * destination. Nothing is fitted to what happens to be visible, nothing is recentred on an
 * "important" object, and no second World camera exists to disagree with the first.
 *
 * If the camera is already exactly that, the act is a true no-op and records nothing.
 */
import { initialCameraIntent } from '../map';
import { committedReturn, type ReturnSurface } from './surface';
import { runReturnPlan } from './authority';
import { withNoOpReason, type ReturnOutcome } from './outcomes';

export function returnWorld(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) =>
    withNoOpReason(runReturnPlan(store, { act: 'RETURN_WORLD', camera: initialCameraIntent() }), 'ALREADY_AT_WORLD_CAMERA'),
  );
}
