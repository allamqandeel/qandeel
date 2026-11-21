/**
 * S4-01 — the Shared World device-proof build's entry point. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s401-proof-entry.mjs --apply` points `main` at it for one proof build (with
 * `S401_SHARED_PROOF=1`), which the S4-01 proof workflow records in its evidence.
 *
 * DIAG-SE-DOOR (diagnostic branch only): the proof root stands inside one full-size View whose capture-phase touch
 * observers record every touch that reaches the application's React root. They never claim the responder.
 */
import { registerRootComponent } from 'expo';
import { View } from 'react-native';

import { qdiagTouch } from '../../diag/se-door-diag';
import { S401ProofRoot } from './S401ProofRoot';

const start = qdiagTouch('touchStart');
const end = qdiagTouch('touchEnd');
const cancel = qdiagTouch('touchCancel');
// React Native's iOS View config carries the capture-phase touch events (BaseViewConfig.ios); its TypeScript types do not.
const observers = { onTouchStartCapture: start, onTouchEndCapture: end, onTouchCancelCapture: cancel } as object;

function DiagRoot() {
  return (
    <View style={{ flex: 1 }} {...observers}>
      <S401ProofRoot />
    </View>
  );
}

registerRootComponent(DiagRoot);
