/**
 * S6-06 (CP2) — the reader's own Introductions status in «التعارف مع قنديل» (P13 / P14b), as the Product Owner approved
 * it (Visual Gate rev.2): «حالة التعارف», why Introductions are paused, and the one explicit act that resumes them —
 * nothing comes back by itself, and QANDEEL checks the reader's current setup first. It concerns the reader only and says
 * nothing about anyone else. In production every resume answers NOT_AVAILABLE_NOW and the line says so plainly.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { typeStyle } from '../conversation';
import { sharedCopy } from '../shared-world/copy';
import { introductionSharingCopy } from './introduction-sharing-copy';
import { Action, Heading, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import type { ParticipationController } from './participation-controller';

const CARD_RADIUS = 16;

export function IntroductionsStatusLine({ ctx, controller }: { readonly ctx: PartContext; readonly controller: ParticipationController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { palette, language, writing } = ctx;
  const copy = introductionSharingCopy(language);
  useEffect(() => {
    controller.refresh();
  }, [controller]);
  const resumed = state.notice === 'RESUMED';
  if (state.line === null && !resumed) return null;

  const said = resumed ? copy.resumed : state.line === 'ACTIVE_INTRODUCTION' ? copy.pausedActive : state.line === 'POST_INTRODUCTION' ? copy.pausedPostIntroduction
    : state.line === 'POST_SUCCESS' ? copy.pausedPostSuccess : copy.pausedOff;
  const resumable = !resumed && (state.line === 'POST_INTRODUCTION' || state.line === 'POST_SUCCESS');
  const offerable = !resumed && state.line !== 'ACTIVE_INTRODUCTION' && state.notice !== 'NOT_AVAILABLE_NOW' && state.notice !== 'NOT_ELIGIBLE';
  const quiet: PartContext = { ...ctx, busy: state.busy, onHeading: undefined };
  return (
    <View testID="qandeel-introductions-status" accessibilityLiveRegion="polite" style={{ paddingBottom: 4 }}>
      <Heading ctx={quiet} text={copy.statusTitle} testID="qandeel-introductions-status-title" />
      <View testID={`qandeel-introductions-status-${resumed ? 'resumed' : (state.line ?? 'none').toLowerCase()}`}
        style={{ backgroundColor: palette.field, borderRadius: CARD_RADIUS, paddingVertical: 12, paddingHorizontal: 16, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginTop: 4, marginBottom: 6 }}>
        <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{said}</Text>
        {resumable ? <Text style={{ ...typeStyle('supporting'), color: palette.secondary, marginTop: 6, writingDirection: writing }}>{copy.resumeNote}</Text> : null}
        {state.notice === 'NOT_ELIGIBLE' ? (
          <Text testID="qandeel-introductions-status-not-eligible" style={{ ...typeStyle('supporting'), color: palette.error, marginTop: 6, writingDirection: writing }}>{copy.notEligible}</Text>
        ) : null}
      </View>
      {state.notice === 'NOT_AVAILABLE_NOW' ? (
        <Text testID="qandeel-introductions-status-unavailable" style={{ ...typeStyle('supporting'), color: palette.error, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {copy.resumeUnavailable}
        </Text>
      ) : null}
      {state.notice === 'FAILED' ? (
        <Text testID="qandeel-introductions-status-failed" style={{ ...typeStyle('supporting'), color: palette.error, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {sharedCopy(language).actionUnavailable}
        </Text>
      ) : null}
      {offerable ? (
        <Action ctx={{ ...quiet, onSheet: true }} primary label={state.notice === 'FAILED' ? sharedCopy(language).retry : state.line === 'OFF' ? copy.turnOn : copy.resume}
          onPress={() => void controller.resume()} testID="qandeel-introductions-resume" />
      ) : null}
    </View>
  );
}
