/**
 * T-10.0 MOTION LAB — a DISPOSABLE prototype owner (T-10.0 §9.1).
 *
 * Nothing in production imports this directory: not the Map barrel, not the orientation chrome,
 * not the app shell, not any runtime Product module. The static guard in
 * `__tests__/isolation.test.ts` proves it. The lab consumes the production layers through their
 * public barrels only, and adds no Product semantics, no dependency, no shell mount and no
 * canonical state. It exists to be looked at, compared, and then deleted or rewritten as the
 * production T-10 motion system once a human has selected a Motion North Star.
 */
export { MotionLab, MOTION_LAB_TEST_ID } from './MotionLab';
export { DIRECTIONS, DIRECTION_IDS, motionProfile, reducedMotionProfile, type DirectionId, type MotionProfile } from './motion/profiles';
