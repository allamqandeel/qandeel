/**
 * S5-02 — the Public authoring workspace, drawn INSIDE the «العالم العام» / Public World root (no second navigation
 * system: its Back returns to the Public root; nothing is registered with the platform).
 *
 *   - the reader's own Drafts (each "not published yet") and the requests that wait on THEIR content approval — each
 *     showing only the exact included content requiring this human's approval (which may be QANDEEL-produced output,
 *     not only their own words) and the publisher's PUBLIC display; never another rightsholder's items, another
 *     approver, sealed provenance or hidden context. The approval covers the content shown, not the Experience;
 *   - choosing existing QANDEEL material for a Draft: the reader's own words in QANDEEL and what they can see in their
 *     Shared Worlds. There is no text field: nothing is composed here;
 *   - the review of exactly what would become public, the CURRENT public display, the approval progress, the reader's
 *     own approval, and "ready for review" once every approval is effective. A package that is no longer whole is one
 *     explicit stale line and nothing of it is drawn. Nothing here says "published", and nothing is placed in the
 *     Public World's field;
 *   - S5-03A, once the Experience is READY_FOR_REVIEW: QANDEEL's understanding — the meaning, the main and other
 *     meanings, and why — with "accept" and "correct the understanding". A correction is the reader's own words for the
 *     MEANING; there is no place, map, coordinate or neighbour anywhere here, and no internal term is shown.
 *
 * Every word is the S5-02 or S5-03A copy module's. The Personal world and the Shared area are never read.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicApprovalRequest, PublicAuthoringReview, PublicOwnApproval, PublicSemanticReview } from '../runtime-entry';
import { fill, publicAuthoringCopy, type PublicAuthoringCopy } from './copy';
import { personalKey, sharedKey, type PublicAuthoringController, type PublicAuthoringNotice } from './public-authoring-controller';
import { PublicSemanticReview as Understanding } from './PublicSemanticReview';
import { publicSemanticCopy, type PublicSemanticCopy } from './semantic-copy';

export const PUBLIC_AUTHORING_TEST_ID = 'qandeel-public-authoring';
const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

const fillTwo = (template: string, first: string, second: string): string => fill(template, first).replace('{1}', second);

const noticeOf = (copy: PublicAuthoringCopy, semantic: PublicSemanticCopy, notice: PublicAuthoringNotice): string | null => {
  switch (notice) {
    case 'INTERPRETATION_UNAVAILABLE': return semantic.interpretationUnavailable;
    case 'NOT_SUPPORTED': return semantic.notSupported;
    case 'QUOTES_CONTENT': return semantic.quotesContent;
    case 'UNCHANGED': return semantic.unchanged;
    case 'CORRECTION_INVALID': return semantic.correctionInvalid;
    case 'LIMITED': return semantic.limited;
    case 'APPROVED': return copy.approved;
    case 'WITHDRAWN': return copy.withdrawn;
    case 'APPROVALS_INCOMPLETE': return copy.approvalsIncomplete;
    case 'NOT_PUBLISHABLE': return copy.notPublishable;
    case 'ACTION_UNAVAILABLE': return copy.actionUnavailable;
    default: return null;
  }
};

interface Shared { readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly copy: PublicAuthoringCopy; readonly writing: 'rtl' | 'ltr' }

function Heading({ text, s, testID }: { readonly text: string; readonly s: Shared; readonly testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="header" accessibilityLanguage={s.language}
      style={{ ...typeStyle('metadata'), color: s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Line({ text, s, role = 'supporting', testID, color }: { readonly text: string; readonly s: Shared; readonly role?: 'supporting' | 'body'; readonly testID?: string; readonly color?: string }) {
  return (
    <Text testID={testID} accessibilityLanguage={s.language}
      style={{ ...typeStyle(role), color: color ?? s.palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Action({ label, onPress, s, testID, busy, emphasis = false }: {
  readonly label: string; readonly onPress: () => void; readonly s: Shared; readonly testID: string; readonly busy: boolean; readonly emphasis?: boolean;
}) {
  return (
    <View style={{ paddingStart: ROW_START - 16, paddingVertical: 4 }}>
      <Control palette={s.palette} language={s.language} accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={onPress} testID={testID}
        style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? s.palette.field : undefined, opacity: busy ? BUSY_OPACITY : 1 }}>
        <Text style={{ ...typeStyle('action'), color: emphasis ? s.palette.primary : s.palette.restInk, writingDirection: s.writing }}>{label}</Text>
      </Control>
    </View>
  );
}

/** The reader's own approval, wherever it is asked: approve — scoped to the content shown — or the recorded state and withdrawal. */
function OwnApproval({ state, manifestId, s, busy, onApprove, onWithdraw, testPrefix }: {
  readonly state: PublicOwnApproval | null; readonly manifestId: string; readonly s: Shared; readonly busy: boolean;
  readonly onApprove: (manifestId: string) => void; readonly onWithdraw: (manifestId: string) => void; readonly testPrefix: string;
}) {
  if (state === 'MISSING') {
    return (
      <>
        <Line text={s.copy.approvalScope} s={s} testID={`${testPrefix}-scope`} />
        <Action label={s.copy.approveShown} onPress={() => onApprove(manifestId)} s={s} busy={busy} emphasis testID={`${testPrefix}-approve`} />
      </>
    );
  }
  if (state === 'EFFECTIVE') {
    return (
      <>
        <Line text={s.copy.approved} s={s} testID={`${testPrefix}-approved`} />
        <Action label={s.copy.withdraw} onPress={() => onWithdraw(manifestId)} s={s} busy={busy} testID={`${testPrefix}-withdraw`} />
      </>
    );
  }
  if (state === 'WITHDRAWN') return <Line text={s.copy.withdrawn} s={s} testID={`${testPrefix}-withdrawn`} />;
  return null;
}

function Request({ request, s, busy, controller }: { readonly request: PublicApprovalRequest; readonly s: Shared; readonly busy: boolean; readonly controller: PublicAuthoringController }) {
  return (
    <View testID="qandeel-public-authoring-request" style={{ paddingVertical: 8 }}>
      {request.publisher ? <Line text={fill(s.copy.requestFrom, request.publisher.label)} s={s} role="body" color={s.palette.primary} /> : null}
      {request.state === 'UNAVAILABLE' ? (
        <Line text={s.copy.noLongerAvailable} s={s} testID="qandeel-public-authoring-request-unavailable" />
      ) : (
        <>
          <Line text={s.copy.approvalContent} s={s} />
          {request.ownItems.map((item) => <Line key={item.ordinal} text={item.text} s={s} role="body" color={s.palette.primary} testID="qandeel-public-authoring-request-word" />)}
          {request.requiredApprovals !== null && request.effectiveApprovals !== null
            ? <Line text={fillTwo(s.copy.approvals, String(request.effectiveApprovals), String(request.requiredApprovals))} s={s} /> : null}
          <OwnApproval state={request.ownApproval} manifestId={request.manifestId} s={s} busy={busy}
            onApprove={controller.approve} onWithdraw={controller.withdraw} testPrefix="qandeel-public-authoring-request" />
        </>
      )}
    </View>
  );
}

function Review({ review, understanding, correcting, s, busy, controller }: {
  readonly review: PublicAuthoringReview; readonly understanding: PublicSemanticReview | null; readonly correcting: boolean; readonly s: Shared;
  readonly busy: boolean; readonly controller: PublicAuthoringController;
}) {
  if (review.state !== 'CURRENT') {
    // Never a partial package: one explicit stale state, and nothing of it.
    return <Line text={s.copy.noLongerAvailable} s={s} role="body" testID="qandeel-public-authoring-review-unavailable" />;
  }
  return (
    <View testID="qandeel-public-authoring-review-current">
      <Line text={review.lifecycle === 'READY_FOR_REVIEW' ? s.copy.readyState : s.copy.draftState} s={s}
        testID={review.lifecycle === 'READY_FOR_REVIEW' ? 'qandeel-public-authoring-ready' : 'qandeel-public-authoring-draft'} />
      <Heading text={s.copy.shownAs} s={s} />
      <Line text={review.publisher.label} s={s} role="body" color={s.palette.primary} testID="qandeel-public-authoring-shown-as" />
      <Heading text={s.copy.reviewHeading} s={s} />
      {review.items.map((item) => (
        <View key={item.ordinal} testID="qandeel-public-authoring-review-item">
          {item.kind === 'ANALYSIS' ? <Line text={s.copy.analysisItem} s={s} /> : null}
          <Line text={item.text} s={s} role="body" color={s.palette.primary} />
        </View>
      ))}
      <Line text={fillTwo(s.copy.approvals, String(review.effectiveApprovals), String(review.requiredApprovals))} s={s} testID="qandeel-public-authoring-progress" />
      {review.lifecycle === 'DRAFT' && review.effectiveApprovals < review.requiredApprovals ? <Line text={s.copy.waiting} s={s} /> : null}
      <OwnApproval state={review.ownApproval} manifestId={review.manifestId} s={s} busy={busy}
        onApprove={controller.approve} onWithdraw={controller.withdraw} testPrefix="qandeel-public-authoring-own" />
      {review.lifecycle === 'DRAFT' && review.readyAllowed
        ? <Action label={s.copy.markReady} onPress={controller.markReady} s={s} busy={busy} emphasis testID="qandeel-public-authoring-mark-ready" /> : null}
      {review.lifecycle === 'READY_FOR_REVIEW' && understanding !== null
        ? <Understanding understanding={understanding} correcting={correcting} palette={s.palette} language={s.language} busy={busy} controller={controller} /> : null}
    </View>
  );
}

export interface PublicAuthoringWorkspaceProps {
  readonly controller: PublicAuthoringController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
}

export function PublicAuthoringWorkspace({ controller, language, palette, bottomInset }: PublicAuthoringWorkspaceProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const copy = publicAuthoringCopy(language);
  const semantic = publicSemanticCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const s: Shared = { palette, language, copy, writing };
  const said = noticeOf(copy, semantic, state.notice);
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);

  const title = state.screen === 'CHOOSE' ? copy.chooseHeading : state.screen === 'REVIEW' ? copy.review : copy.workspaceTitle;

  return (
    <View testID={PUBLIC_AUTHORING_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, direction: writing }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingStart: ROW_START - 16, paddingEnd: ROW_END, columnGap: 4 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={controller.back} testID="qandeel-public-authoring-back"
          style={{ paddingHorizontal: 16 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.back}</Text>
        </Control>
        <Text accessibilityRole="header" accessibilityLanguage={language} testID="qandeel-public-authoring-title"
          style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
        {said !== null ? <Line text={said} s={s} testID="qandeel-public-authoring-notice" color={palette.primary} /> : null}
        {state.status === 'UNAVAILABLE' ? (
          <View testID="qandeel-public-authoring-unavailable">
            <Line text={copy.actionUnavailable} s={s} role="body" />
            <Action label={copy.retry} onPress={controller.refresh} s={s} busy={state.busy} testID="qandeel-public-authoring-retry" />
          </View>
        ) : state.status === 'LOADING' ? (
          <View testID="qandeel-public-authoring-loading" accessible accessibilityState={{ busy: true }} style={{ minHeight: MIN_TARGET }} />
        ) : state.screen === 'WORKSPACE' ? (
          <View testID="qandeel-public-authoring-workspace">
            <Action label={copy.startDraft} onPress={controller.startDraft} s={s} busy={state.busy} emphasis testID="qandeel-public-authoring-start" />
            <Heading text={copy.draftsHeading} s={s} />
            {state.drafts.length === 0 ? <Line text={copy.noDrafts} s={s} testID="qandeel-public-authoring-no-drafts" /> : state.drafts.map((draft) => (
              <Action key={draft.experienceId} label={draft.lifecycle === 'READY_FOR_REVIEW' ? copy.readyState : copy.draftState}
                onPress={() => controller.openDraft(draft.experienceId)} s={s} busy={state.busy} testID="qandeel-public-authoring-draft-row" />
            ))}
            {state.requests.length > 0 ? <Heading text={copy.requestsHeading} s={s} testID="qandeel-public-authoring-requests" /> : null}
            {state.requests.map((request) => <Request key={request.manifestId} request={request} s={s} busy={state.busy} controller={controller} />)}
          </View>
        ) : state.screen === 'CHOOSE' ? (
          <View testID="qandeel-public-authoring-choose">
            <Line text={copy.chooseHint} s={s} />
            {state.sources !== null && state.sources.personal.length === 0 && state.sources.shared.length === 0
              ? <Line text={copy.noSources} s={s} testID="qandeel-public-authoring-no-sources" /> : null}
            {state.sources !== null && state.sources.personal.length > 0 ? <Heading text={copy.qandeel} s={s} /> : null}
            {state.sources?.personal.map((source) => {
              const key = personalKey(source.sourceId);
              const checked = state.selected.includes(key);
              return (
                <Control key={key} palette={palette} language={language} accessibilityRole="togglebutton" accessibilityLabel={source.text}
                  accessibilityState={{ checked, disabled: state.busy }} onPress={() => controller.toggle(key)} testID="qandeel-public-authoring-source"
                  style={{ paddingHorizontal: ROW_START - 8, backgroundColor: checked ? palette.field : undefined }}>
                  <Text style={{ ...typeStyle('body'), color: checked ? palette.primary : palette.secondary, writingDirection: writing }}>{source.text}</Text>
                </Control>
              );
            })}
            {state.sources !== null && state.sources.shared.length > 0 ? <Heading text={copy.sharedWorld} s={s} /> : null}
            {state.sources?.shared.map((source) => {
              const key = sharedKey(source.worldId, source.materialId);
              const checked = state.selected.includes(key);
              const author = source.producer === 'QANDEEL' ? copy.qandeel : source.isSelf ? copy.you : source.authorName;
              return (
                <Control key={key} palette={palette} language={language} accessibilityRole="togglebutton"
                  accessibilityLabel={author ? `${author}: ${source.text}` : source.text}
                  accessibilityState={{ checked, disabled: state.busy }} onPress={() => controller.toggle(key)} testID="qandeel-public-authoring-source"
                  style={{ paddingHorizontal: ROW_START - 8, backgroundColor: checked ? palette.field : undefined }}>
                  {author ? <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{author}</Text> : null}
                  <Text style={{ ...typeStyle('body'), color: checked ? palette.primary : palette.secondary, writingDirection: writing }}>{source.text}</Text>
                </Control>
              );
            })}
            {state.selected.length > 0
              ? <Action label={copy.review} onPress={controller.prepare} s={s} busy={state.busy} emphasis testID="qandeel-public-authoring-prepare" /> : null}
          </View>
        ) : state.review !== null ? (
          <Review review={state.review} understanding={state.semantic} correcting={state.correcting} s={s} busy={state.busy} controller={controller} />
        ) : null}
      </ScrollView>
    </View>
  );
}
