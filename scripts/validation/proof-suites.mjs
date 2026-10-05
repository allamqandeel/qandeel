/**
 * VAL-01 — the isolated device-proof suites, as DATA. A suite names its workflow, its build recipe and one
 * leg runner per platform; the legs and the flows each leg runs are derived from the runner itself
 * (`proof-legs.mjs`). A Stage-4 proof adds an entry here and a runner of the same shape — it does not copy
 * A3 logic.
 *
 * `physicalDeviceFacts` are the facts a simulator cannot establish (Task Contract §11). They are listed so
 * the boundary is stated by the proof architecture, can never be a runner leg, and are never scheduled in
 * a simulator matrix. Their Product ownership is unchanged: A3-02 record §20 and `QAN-BL-NOTIF-05`.
 */

import { DISPOSITIONS } from './proof-legs.mjs';

const physical = (id, fact) => Object.freeze({ id, fact, disposition: DISPOSITIONS.PHYSICAL_DEVICE_REQUIRED, owner: 'QAN-BL-NOTIF-05' });

export const PROOF_SUITES = Object.freeze({
  a3: Object.freeze({
    workflow: '.github/workflows/a3-proof.yml',
    recipe: 'a3-activity-push-proof',
    platforms: Object.freeze({
      android: Object.freeze({ runner: 'scripts/a3/run-proof-leg.sh', producer: 'build-android', consumer: 'android-leg' }),
      ios: Object.freeze({ runner: 'scripts/a3/run-ios-proof-leg.sh', producer: 'build-ios', consumer: 'ios-leg' }),
    }),
    physicalDeviceFacts: Object.freeze([
      physical('PD-01', 'production FCM / APNs credentials provisioned; dispatcher enabled'),
      physical('PD-02', 'real FCM receipt on a physical Android device, background and terminated'),
      physical('PD-03', 'real APNs receipt on a physical iPhone, background and terminated'),
      physical('PD-04', 'Lock Screen appearance at L0 and L2 on a secure lock screen'),
      physical('PD-05', 'token rotation / reinstall / account switch stops the old address'),
      physical('PD-06', 'a tap from the real OS tray reaches Direct Entry'),
      physical('PD-07', 'the real permission prompts and the settings hand-off'),
      physical('PD-08', 'no app-icon badge on either platform'),
      physical('PD-09', 'VoiceOver / TalkBack on the education sheet and the device section'),
    ]),
  }),
});
