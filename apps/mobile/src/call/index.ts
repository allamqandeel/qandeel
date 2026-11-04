/**
 * S8B-06 CP3 — the live call as the Product composes it. The composition (`integration/`) reaches the call ONLY through
 * this module: the call's one socket, its engine and its platform call stay in `voice-call/`, behind the owner.
 */
import { BackHandler } from 'react-native';

import type { LiveCallSocketFactory } from '../voice-call/live-call-client';
import { loadCallPlatform, loadVoiceCallEngine, type CallPlatform, type VoiceCallEngine } from '../voice-call/voice-call-engine';

export type { CallOwner, CallOwnerOptions, CallOwnerState, CallRecord, CallStage, CarriedTextOutcome } from './call-owner';
export { callIdOfKey, createCallOwner, LIVE_CALL_KEY_PREFIX, liveCallKey, noticeOf } from './call-owner';
export { createCallAwareConversationTransport } from './call-text-transport';
export type { CallSurfaceSlots } from './CallViews';
export {
  CALL_ENTRY_TEST_ID, CALL_LINE_TEST_ID, CALL_NOTICE_TEST_ID, CALL_RECORD_TEST_ID, CallEntryControl, CallLine, CallNoticeLine, CallRecordRow,
  callIdOf, callIsLive, callStatusLines, formatCallLength, useCallOwnerState, useCallSurface,
} from './CallViews';

/** The device's call parts: the platform call and the audio engine (null where the build has none: Jest, an unlinked build). */
export interface CallDevice {
  readonly platform: CallPlatform | null;
  readonly engine: VoiceCallEngine | null;
  /** Tests and the device proof only. */
  readonly socketFactory?: LiveCallSocketFactory;
  /** The device proof's local server only; the call client still refuses anything but the loopback. */
  readonly insecureLoopbackForProof?: boolean;
  /** The system Back key (R1); absent in tests unless a test asks. */
  readonly backKey?: (handler: () => boolean) => () => void;
}

export function loadCallDevice(): CallDevice {
  return {
    platform: loadCallPlatform(),
    engine: loadVoiceCallEngine(),
    backKey: (handler) => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
      return () => subscription.remove();
    },
  };
}

export type { CallPlatform, VoiceCallEngine };
