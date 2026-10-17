/**
 * S6-06 (CP2) — SUCCESS in the live Introduction World (P10 – P12), as the Product Owner approved it (Visual Gate rev.2,
 * V-5): the proposal takes the opening's place, inside the same 2px start-edge seam, and is drawn ONLY when the server
 * returns a real transition version — which nothing produces before Stage 8A, so production never draws it.
 *
 *   P10  the proposal (PD-40, PD-41) and the reader's own approval (PD-42).
 *   P11  after approving: the reader's own state only (PD-43) and the withdrawal (PD-44) — never anything about the other
 *        person's decision, no countdown, no nudge. CHANGED (PD-47) when the server's state moved during the request.
 *   P12  completed: the same World and the same history continue as a Shared World (PD-45); the reader opens it in the
 *        existing Shared World screen (PD-46). No relationship meaning is carried.
 */
import { Text, View } from 'react-native';

import { typeStyle } from '../conversation';
import { sharedCopy } from '../shared-world/copy';
import type { IntroductionSharingController, IntroductionSuccessView } from './introduction-sharing-controller';
import { introductionSharingCopy } from './introduction-sharing-copy';
import { Action, LOCAL_TYPE, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';

/** V-1's opening seam values, shared with the World's own opening. */
const SEAM_GAP = 14;
const HAIRLINE_OPACITY = 0.4;

/** P10 / P11 — in the opening's place while the Introduction lives and a transition exists. */
export function SuccessProposal({ ctx, sharing, success }: {
  readonly ctx: PartContext; readonly sharing: IntroductionSharingController; readonly success: IntroductionSuccessView;
}) {
  const { palette, language, writing, onHeading } = ctx;
  const copy = introductionSharingCopy(language);
  const approved = success.myState === 'APPROVED';
  const prime: PartContext = { ...ctx, onSheet: true, busy: success.busy, onHeading: undefined };
  const quiet: PartContext = { ...ctx, busy: success.busy, onHeading: undefined };
  return (
    <View testID="qandeel-introduction-success">
      <View testID="qandeel-introduction-success-opening"
        style={{ marginStart: ROW_START, marginEnd: ROW_END, marginTop: 6, marginBottom: 4, paddingVertical: 6, paddingStart: SEAM_GAP,
          borderStartWidth: palette.markerThickness, borderStartColor: palette.selectedMarker }}>
        <Text ref={onHeading} accessibilityRole="header" accessibilityLanguage={language} style={{ ...LOCAL_TYPE.question, color: palette.primary, writingDirection: writing }}>
          {copy.successTitle}
        </Text>
        <Text testID={approved ? 'qandeel-introduction-success-approved' : 'qandeel-introduction-success-body'}
          style={{ ...typeStyle('supporting'), color: palette.secondary, marginTop: 6, writingDirection: writing }}>
          {approved ? copy.successApproved : copy.successBody}
        </Text>
      </View>
      <View accessibilityLiveRegion="polite" testID="qandeel-introduction-success-status" style={{ marginStart: ROW_START, marginEnd: ROW_END }}>
        {success.notice === null ? null : (
          <Text style={{ ...typeStyle('supporting'), color: palette.error, paddingTop: 4, writingDirection: writing }}>
            {success.notice === 'CHANGED' ? copy.changed : sharedCopy(language).actionUnavailable}
          </Text>
        )}
      </View>
      {approved ? (
        <View style={{ alignItems: 'flex-start', paddingStart: ROW_START - 8 }}>
          <Action ctx={quiet} inline label={copy.successWithdraw} onPress={() => void sharing.withdrawSuccess()} testID="qandeel-introduction-success-withdraw" />
        </View>
      ) : (
        <Action ctx={prime} primary label={success.notice === 'FAILED' ? sharedCopy(language).retry : copy.successApprove}
          onPress={() => void sharing.approveSuccess()} testID="qandeel-introduction-success-approve" />
      )}
      <View style={{ height: 1, marginTop: 14, marginBottom: 4, marginStart: ROW_START, marginEnd: ROW_END, backgroundColor: palette.tertiary, opacity: HAIRLINE_OPACITY }} />
    </View>
  );
}

/** P12 — completed: the moment, and the way into the existing Shared World screen. */
export function SuccessCompleted({ ctx, onOpen }: { readonly ctx: PartContext; readonly onOpen?: () => void }) {
  const { palette, language, writing, onHeading } = ctx;
  const copy = introductionSharingCopy(language);
  return (
    <View testID="qandeel-introduction-success-completed" style={{ paddingTop: 40 }}>
      <View style={{ marginStart: ROW_START, marginEnd: ROW_END, paddingVertical: 6, paddingStart: SEAM_GAP, borderStartWidth: palette.markerThickness, borderStartColor: palette.selectedMarker }}>
        <Text ref={onHeading} accessibilityRole="header" accessibilityLanguage={language} accessibilityLiveRegion="polite"
          style={{ ...LOCAL_TYPE.name, color: palette.primary, writingDirection: writing }}>
          {copy.successCompleted}
        </Text>
      </View>
      {onOpen === undefined ? null : <Action ctx={{ ...ctx, onSheet: true, onHeading: undefined }} primary label={copy.successOpen} onPress={onOpen} testID="qandeel-introduction-success-open" />}
    </View>
  );
}
