/**
 * S4-03 — «إدارة العالم» / Manage World: the ONE calm management place of the exact Shared World governed (I-08A4 §7:
 * "World governance belongs to the exact Shared World governed"; P1: no Settings page nested in a World). It shows only
 * what the reader may know and lets them do only what the frozen lifecycle allows:
 *
 *   - «إعدادات العالم» / World Settings — the committed name, description and topic; a change is a PROPOSAL that needs
 *     every current member's approval (CW2-03 §30), the proposer's included: proposing is never approving;
 *   - the proposals that wait on THIS reader — a settings change, a removal (never shown to the person it would remove:
 *     they hold no vote on it, CW2-03 §25), an add / a rejoin (whose person is never named before they accept) or the
 *     World's end — each with who proposed it (no authority comes with it), the neutral progress, and Approve or "you
 *     approved". Who else approved is never shown;
 *   - adding a member — or bringing a former one back — by the person's CURRENT Shared ID (P1 §5.2): one answer that
 *     names nobody, then every current member's approval, then the person's own acceptance;
 *   - the requests to share the reader's OWN earlier words with one member (only the reader's own words are shown);
 *   - the current members, each with "propose removing" and "share earlier messages" — the latter reads the exact
 *     messages the reader may offer, item by item, one bounded page at a time (no canonical topic / Session grouping
 *     exists), and shows the exact preview of what that member would see before anything is proposed;
 *   - leaving (a human exit right: never behind the governance capability) and ending the World, each behind a calm
 *     confirmation that states the consequence BEFORE the act.
 *
 * Every word is the S4-03 copy module's. Every nested panel returns the screen reader to the row that opened it.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, TextInput, View, findNodeHandle } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { SharedLifecycleMember, SharedProposal } from '../runtime-entry';
import { fill } from './copy';
import { sharedLifecycleCopy, type SharedLifecycleCopy } from './lifecycle-copy';
import type { SharedManageNotice, SharedWorldController } from './shared-world-controller';

const ROW_START = 24;
const ROW_END = 20;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;
const BUSY_OPACITY = 0.6;
/** One package of earlier history: the 0140 bound. */
export const SHARED_HISTORY_PACKAGE_MAX = 20;
/** The engineering input bounds the server re-checks (0140). */
const BOUNDS = { name: 80, description: 500, topic: 120 } as const;

type Panel =
  | { readonly kind: 'SETTINGS' }
  | { readonly kind: 'ADD' }
  | { readonly kind: 'REMOVE'; readonly member: SharedLifecycleMember }
  | { readonly kind: 'SHARE'; readonly member: SharedLifecycleMember }
  | { readonly kind: 'LEAVE' }
  | { readonly kind: 'END' };

/** A template with two placeholders ({0}, {1}). */
const fillTwo = (template: string, first: string, second: string): string => fill(template, first).replace('{1}', second);

const noticeOf = (copy: SharedLifecycleCopy, notice: SharedManageNotice): string | null => {
  switch (notice) {
    case 'PROPOSED': return copy.proposalSent;
    case 'MEMBER_SUBMITTED': return copy.memberRequestSent;
    case 'INVALID_SHARED_ID': return copy.invalidSharedId;
    case 'INVITED': return copy.invited;
    case 'UNCHANGED': return copy.unchanged;
    case 'APPROVED': return copy.approvedWaiting;
    case 'COMMITTED': return copy.committed;
    case 'GRANTED': return copy.granted;
    case 'STALE': return copy.stale;
    case 'REFUSED':
    case 'UNAVAILABLE': return copy.actionUnavailable;
    default: return null;
  }
};

function Heading({ text, palette, language }: { readonly text: string; readonly palette: ConversationPalette; readonly language: ChromeLanguage }) {
  return (
    <Text accessibilityRole="header" accessibilityLanguage={language}
      style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
      {text}
    </Text>
  );
}

function Action({ label, onPress, palette, language, testID, busy = false, emphasis = false, rowRef }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly busy?: boolean;
  readonly emphasis?: boolean;
  readonly rowRef?: (node: View | null) => void;
}) {
  return (
    <View ref={rowRef}>
      <Control palette={palette} language={language} accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={onPress} testID={testID}
        style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? palette.field : undefined, opacity: busy ? BUSY_OPACITY : 1 }}>
        <Text style={{ ...typeStyle('action'), color: emphasis ? palette.primary : palette.restInk }}>{label}</Text>
      </Control>
    </View>
  );
}

export function SharedManagePage({ controller, language, palette, bottomInset }: {
  readonly controller: SharedWorldController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
}) {
  const copy = sharedLifecycleCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const manage = state.manage;
  const data = manage.data;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const rows = useRef(new Map<string, View | null>());
  const rowRef = useCallback((key: string) => (node: View | null) => { rows.current.set(key, node); }, []);
  const said = noticeOf(copy, manage.notice);
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);
  // A nested panel closes back to the row that opened it.
  useEffect(() => {
    if (returnTo === null || panel !== null) return;
    const target = rows.current.get(returnTo);
    const node = target === null || target === undefined ? null : findNodeHandle(target);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [panel, returnTo]);
  const open = (next: Panel, key: string) => {
    setReturnTo(key);
    setPanel(next);
  };
  const close = () => setPanel(null);

  if (data === null) {
    return manage.status === 'UNAVAILABLE' ? (
      <View testID="qandeel-shared-manage-unavailable" style={{ padding: ROW_START, rowGap: 8 }}>
        <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.actionUnavailable}</Text>
        <Action label={copy.retry} onPress={() => controller.refreshManage()} palette={palette} language={language} testID="qandeel-shared-manage-retry" />
      </View>
    ) : <View testID="qandeel-shared-manage-loading" accessibilityState={{ busy: true }} style={{ padding: ROW_START }} />;
  }

  const busy = manage.busy !== null;
  const governance = data.capabilities.governance;
  const history = data.capabilities.history;
  const value = (text: string | null) => (text === null || text.length === 0 ? copy.notSet : text);
  const proposalTitle = (proposal: SharedProposal) => (proposal.kind === 'SETTINGS' ? copy.proposalSettings
    : proposal.kind === 'REMOVAL' ? fill(copy.proposalRemoval, proposal.targetName ?? copy.someone)
      : proposal.kind === 'ADD' ? copy.proposalAdd : proposal.kind === 'REJOIN' ? copy.proposalRejoin : copy.proposalEnd);

  return (
    <View testID="qandeel-shared-manage" style={{ paddingBottom: bottomInset + 16 }}>
      <View testID="qandeel-shared-manage-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {said === null ? null : <Text style={{ ...typeStyle('supporting'), color: manage.notice === 'STALE' || manage.notice === 'REFUSED' || manage.notice === 'UNAVAILABLE' || manage.notice === 'INVALID_SHARED_ID' ? palette.error : palette.secondary, paddingTop: 10, writingDirection: writing }}>{said}</Text>}
      </View>
      {governance ? null : (
        <Text testID="qandeel-shared-governance-not-open" style={{ ...typeStyle('supporting'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 12, writingDirection: writing }}>
          {copy.governanceNotOpen}
        </Text>
      )}
      {history ? null : (
        <Text testID="qandeel-shared-history-not-open" style={{ ...typeStyle('supporting'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 6, writingDirection: writing }}>
          {copy.historyNotOpen}
        </Text>
      )}

      {/* «إعدادات العالم» / World Settings — the committed values; a change is a unanimous proposal. */}
      <Heading text={copy.worldSettings} palette={palette} language={language} />
      <View testID="qandeel-shared-settings" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, rowGap: 6 }}>
        {([[copy.nameLabel, data.settings.name, 'name'], [copy.descriptionLabel, data.settings.description, 'description'], [copy.topicLabel, data.settings.topic, 'topic']] as const).map(([term, text, key]) => (
          <View key={key} testID={`qandeel-shared-setting-${key}`} accessible accessibilityLabel={`${term}: ${value(text)}`} accessibilityLanguage={language} style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{term}</Text>
            <Text style={{ ...typeStyle('body'), color: text === null ? palette.tertiary : palette.primary, writingDirection: writing }}>{value(text)}</Text>
          </View>
        ))}
      </View>
      {governance && panel?.kind !== 'SETTINGS' ? (
        <View style={{ paddingStart: ROW_START - 16, paddingTop: 6 }}>
          <Action label={copy.proposeChange} onPress={() => open({ kind: 'SETTINGS' }, 'settings')} palette={palette} language={language} testID="qandeel-shared-propose-settings" rowRef={rowRef('settings')} />
        </View>
      ) : null}
      {governance && panel?.kind === 'SETTINGS' ? (
        <SettingsForm copy={copy} language={language} palette={palette} current={data.settings} busy={busy}
          onCancel={close}
          onSend={async (values) => {
            const result = await controller.proposeSettings(values);
            if (result === 'PROPOSED' || result === 'UNCHANGED') close();
          }} />
      ) : null}

      {/* Adding a member, or bringing a former one back, by the person's CURRENT Shared ID. */}
      {governance && panel?.kind !== 'ADD' ? (
        <View style={{ paddingStart: ROW_START - 16, paddingTop: 10 }}>
          <Action label={copy.addMember} onPress={() => open({ kind: 'ADD' }, 'add')} palette={palette} language={language} testID="qandeel-shared-add-member" rowRef={rowRef('add')} />
        </View>
      ) : null}
      {governance && panel?.kind === 'ADD' ? (
        <AddMemberForm copy={copy} language={language} palette={palette} busy={busy} onCancel={close}
          onSend={async (sharedId) => {
            const result = await controller.proposeMember(sharedId);
            if (result === 'SUBMITTED') close();
          }} />
      ) : null}

      {/* The proposals that wait on THIS reader. */}
      {data.proposals.length > 0 ? (
        <View testID="qandeel-shared-proposals">
          <Heading text={copy.proposalsHeading} palette={palette} language={language} />
          {data.proposals.map((proposal) => (
            <View key={proposal.proposalId} testID={`qandeel-shared-proposal-${proposal.kind.toLowerCase()}`} style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, rowGap: 6 }}>
              <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{proposalTitle(proposal)}</Text>
              <Text testID="qandeel-shared-proposal-proposer" style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>
                {proposal.proposer.self ? copy.proposedBySelf : fill(copy.proposedBy, proposal.proposer.name ?? copy.someone)}
              </Text>
              <Text testID="qandeel-shared-proposal-progress" style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>
                {fillTwo(copy.progress, String(proposal.progress.approved), String(proposal.progress.required))}
              </Text>
              {proposal.settings === null ? null : (
                <View style={{ rowGap: 2 }}>
                  {([[copy.nameLabel, proposal.settings.name], [copy.descriptionLabel, proposal.settings.description], [copy.topicLabel, proposal.settings.topic]] as const).map(([term, text]) => (
                    <Text key={term} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{`${term}: ${value(text)}`}</Text>
                  ))}
                </View>
              )}
              {proposal.approvedBySelf ? (
                <Text testID="qandeel-shared-proposal-approved" style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{copy.approvedWaiting}</Text>
              ) : governance ? (
                <Action label={copy.approve} emphasis busy={manage.busy === `approve|${proposal.proposalId}`} onPress={() => void controller.approve(proposal.proposalId)}
                  palette={palette} language={language} testID="qandeel-shared-approve" />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* The requests to share the reader's OWN earlier words with one member. */}
      {data.historyRequests.length > 0 ? (
        <View testID="qandeel-shared-share-requests">
          <Heading text={copy.shareRequestsHeading} palette={palette} language={language} />
          {data.historyRequests.map((request) => (
            <View key={request.packageId} testID="qandeel-shared-share-request" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, rowGap: 6 }}>
              <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{fill(copy.shareRequest, request.granteeName ?? copy.someone)}</Text>
              {request.items.map((item) => (
                <Text key={item.materialId} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{item.text}</Text>
              ))}
              {request.approvedBySelf ? (
                <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{copy.approvedWaiting}</Text>
              ) : history ? (
                <Action label={copy.approve} emphasis busy={manage.busy === `shareApprove|${request.packageId}`} onPress={() => void controller.approveHistoryShare(request.packageId)}
                  palette={palette} language={language} testID="qandeel-shared-share-approve" />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* The current members: removal and sharing earlier messages are proposals about one exact member. */}
      <Heading text={copy.membersHeading} palette={palette} language={language} />
      <View testID="qandeel-shared-manage-members">
        {data.members.map((member, index) => {
          const name = member.self ? copy.you : member.name ?? copy.someone;
          return (
            <View key={member.handle} testID={`qandeel-shared-manage-member-${index}`} style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, rowGap: 4 }}>
              <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{name}</Text>
              {member.self ? null : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginStart: -16 }}>
                  {governance ? <Action label={copy.proposeRemoval} onPress={() => open({ kind: 'REMOVE', member }, `remove-${member.handle}`)} palette={palette} language={language}
                    testID={`qandeel-shared-propose-removal-${index}`} rowRef={rowRef(`remove-${member.handle}`)} /> : null}
                  {history ? <Action label={fill(copy.shareWith, name)} onPress={() => { open({ kind: 'SHARE', member }, `share-${member.handle}`); controller.loadHistoryCandidates(member.handle); }}
                    palette={palette} language={language} testID={`qandeel-shared-share-with-${index}`} rowRef={rowRef(`share-${member.handle}`)} /> : null}
                </View>
              )}
              {panel?.kind === 'REMOVE' && panel.member.handle === member.handle ? (
                <Confirm explain={fill(copy.removeExplain, name)} confirm={copy.confirmRemoval} cancel={copy.cancel} busy={busy} palette={palette} language={language} testID="qandeel-shared-removal-confirm"
                  onCancel={close} onConfirm={async () => { const result = await controller.proposeRemoval(member.handle); if (result !== 'UNAVAILABLE') close(); }} />
              ) : null}
              {panel?.kind === 'SHARE' && panel.member.handle === member.handle ? (
                <SharePanel controller={controller} copy={copy} language={language} palette={palette} memberName={name} memberHandle={member.handle} onClose={close} />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Leaving is a human exit right: never behind the governance capability. Ending the World is a proposal. */}
      <View style={{ paddingStart: ROW_START - 16, paddingTop: 22, rowGap: 6 }}>
        {panel?.kind === 'LEAVE' ? (
          <View style={{ paddingStart: 16 }}>
            <Confirm explain={copy.leaveExplain} confirm={copy.leaveConfirm} cancel={copy.cancel} busy={busy} palette={palette} language={language} testID="qandeel-shared-leave-confirm"
              onCancel={close} onConfirm={async () => { const result = await controller.leaveWorld(); if (result !== null && result !== 'LEFT') close(); }} />
          </View>
        ) : <Action label={copy.leave} onPress={() => open({ kind: 'LEAVE' }, 'leave')} palette={palette} language={language} testID="qandeel-shared-leave" rowRef={rowRef('leave')} />}
        {governance ? (panel?.kind === 'END' ? (
          <View style={{ paddingStart: 16 }}>
            <Confirm explain={copy.endExplain} confirm={copy.endConfirm} cancel={copy.cancel} busy={busy} palette={palette} language={language} testID="qandeel-shared-end-confirm"
              onCancel={close} onConfirm={async () => { const result = await controller.proposeEnd(); if (result !== 'UNAVAILABLE') close(); }} />
          </View>
        ) : <Action label={copy.endWorld} onPress={() => open({ kind: 'END' }, 'end')} palette={palette} language={language} testID="qandeel-shared-end" rowRef={rowRef('end')} />) : null}
      </View>
    </View>
  );
}

/** A consequence stated BEFORE its act, then the act and the way out. */
function Confirm({ explain, confirm, cancel, busy, palette, language, testID, onCancel, onConfirm }: {
  readonly explain: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly busy: boolean;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => Promise<void>;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const explainRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = explainRef.current === null ? null : findNodeHandle(explainRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  return (
    <View testID={testID} style={{ rowGap: 8, paddingTop: 6 }}>
      <Text ref={explainRef} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{explain}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
        <Control palette={palette} language={language} accessibilityLabel={cancel} accessibilityState={{ disabled: busy }} onPress={() => { if (!busy) onCancel(); }}
          testID={`${testID}-cancel`} style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{cancel}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={confirm} accessibilityState={{ busy, disabled: busy }} onPress={() => { if (!busy) void onConfirm(); }}
          testID={`${testID}-action`} style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{confirm}</Text>
        </Control>
      </View>
    </View>
  );
}

/** The three World Settings of one proposal: the current values to start from, sent as one exact version. */
function SettingsForm({ copy, language, palette, current, busy, onCancel, onSend }: {
  readonly copy: SharedLifecycleCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly current: { readonly name: string | null; readonly description: string | null; readonly topic: string | null };
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSend: (values: { readonly name: string; readonly description: string; readonly topic: string }) => Promise<void>;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const [name, setName] = useState(current.name ?? '');
  const [description, setDescription] = useState(current.description ?? '');
  const [topic, setTopic] = useState(current.topic ?? '');
  const [focused, setFocused] = useState<string | null>(null);
  const field = (key: 'name' | 'description' | 'topic', label: string, text: string, set: (value: string) => void, multiline = false) => (
    <View key={key} style={{ rowGap: 4 }}>
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{label}</Text>
      <TextInput testID={`qandeel-shared-settings-${key}`} value={text} onChangeText={set} editable={!busy} maxLength={BOUNDS[key]} multiline={multiline}
        accessibilityLabel={label} accessibilityLanguage={language} placeholder={copy.notSet} placeholderTextColor={palette.tertiary}
        onFocus={() => setFocused(key)} onBlur={() => setFocused(null)} selectionColor={palette.primary} cursorColor={palette.primary}
        style={{
          ...typeStyle('body'), color: palette.primary, backgroundColor: palette.field, minHeight: FIELD_MIN_HEIGHT, borderRadius: FIELD_RADIUS,
          paddingHorizontal: 14, paddingVertical: 9, borderWidth: palette.focusThickness, borderColor: focused === key ? palette.focusIndicator : palette.field,
          writingDirection: writing, textAlign: writing === 'rtl' ? 'right' : 'left',
        }} />
    </View>
  );
  return (
    <View testID="qandeel-shared-settings-form" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 10, rowGap: 10 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.proposeSettingsExplain}</Text>
      {field('name', copy.nameLabel, name, setName)}
      {field('description', copy.descriptionLabel, description, setDescription, true)}
      {field('topic', copy.topicLabel, topic, setTopic)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 8 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: busy }} onPress={() => { if (!busy) onCancel(); }}
          testID="qandeel-shared-settings-cancel" style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={copy.sendProposal} accessibilityState={{ busy, disabled: busy }}
          onPress={() => { if (!busy) void onSend({ name, description, topic }); }} testID="qandeel-shared-settings-send"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.sendProposal}</Text>
        </Control>
      </View>
    </View>
  );
}

/**
 * Adding a member, or bringing a former one back, by the person's CURRENT Shared ID. The field is S4-01's approved Shared
 * ID field; the answer names nobody, whatever the ID turns out to be.
 */
function AddMemberForm({ copy, language, palette, busy, onCancel, onSend }: {
  readonly copy: SharedLifecycleCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSend: (sharedId: string) => Promise<void>;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const [sharedId, setSharedId] = useState('');
  const [focused, setFocused] = useState(false);
  const ready = sharedId.trim().length > 0;
  return (
    <View testID="qandeel-shared-add-member-form" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 10, rowGap: 10 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.addMemberExplain}</Text>
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.inviteFieldLabel}</Text>
      {/* The Shared ID is a Latin pattern: typed and read left to right in both languages (W3-PDG-01 §4). */}
      <TextInput testID="qandeel-shared-add-member-id" value={sharedId} onChangeText={setSharedId} editable={!busy} maxLength={32}
        autoCapitalize="characters" autoCorrect={false} autoComplete="off" accessibilityLabel={copy.inviteFieldLabel} accessibilityLanguage={language}
        placeholder={copy.inviteHint} placeholderTextColor={palette.tertiary} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        selectionColor={palette.primary} cursorColor={palette.primary}
        style={{
          ...typeStyle('body'), color: palette.primary, backgroundColor: palette.field, minHeight: FIELD_MIN_HEIGHT, borderRadius: FIELD_RADIUS,
          paddingHorizontal: 14, paddingVertical: 9, borderWidth: palette.focusThickness, borderColor: focused ? palette.focusIndicator : palette.field,
          writingDirection: 'ltr', textAlign: 'left',
        }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 8 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: busy }} onPress={() => { if (!busy) onCancel(); }}
          testID="qandeel-shared-add-member-cancel" style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={copy.sendRequest} accessibilityState={{ busy, disabled: busy || !ready }}
          onPress={() => { if (!busy && ready) void onSend(sharedId); }} testID="qandeel-shared-add-member-send"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field, opacity: busy || !ready ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.sendRequest}</Text>
        </Control>
      </View>
    </View>
  );
}

/**
 * Sharing earlier messages with one member: the exact messages the reader may offer (explicit item-level multi-select, at
 * most 20 per package: no canonical grouping exists), one bounded page at a time with older pages on request, the exact
 * preview of what that member would see, then ONE proposal. Nothing becomes visible until every author of a chosen
 * message approves it.
 */
function SharePanel({ controller, copy, language, palette, memberName, memberHandle, onClose }: {
  readonly controller: SharedWorldController;
  readonly copy: SharedLifecycleCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly memberName: string;
  readonly memberHandle: string;
  readonly onClose: () => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const candidates = state.manage.candidates?.memberHandle === memberHandle ? state.manage.candidates : null;
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const busy = state.manage.busy !== null;
  const toggle = (materialId: string) => setChosen((held) => (held.includes(materialId) ? held.filter((id) => id !== materialId)
    : held.length >= SHARED_HISTORY_PACKAGE_MAX ? held : [...held, materialId]));
  const preview = (candidates?.list ?? []).filter((c) => chosen.includes(c.materialId));
  return (
    <View testID="qandeel-shared-share-panel" style={{ rowGap: 8, paddingTop: 6 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.shareExplain}</Text>
      {candidates === null || candidates.status === 'LOADING' ? <View accessibilityState={{ busy: true }} style={{ minHeight: MIN_TARGET }} /> : null}
      {candidates?.status === 'UNAVAILABLE' ? <Text style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>{copy.actionUnavailable}</Text> : null}
      {candidates?.status === 'READY' && candidates.list.length === 0 ? (
        <Text testID="qandeel-shared-share-none" style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{fill(copy.noCandidates, memberName)}</Text>
      ) : null}
      {candidates?.status === 'READY' ? candidates.list.map((candidate) => {
        const checked = chosen.includes(candidate.materialId);
        const author = candidate.self ? copy.you : candidate.authorName ?? copy.someone;
        return (
          <Control key={candidate.materialId} palette={palette} language={language} accessibilityRole="togglebutton" accessibilityState={{ checked, disabled: busy }}
            accessibilityLabel={`${author}: ${candidate.text}`} onPress={() => { if (!busy) toggle(candidate.materialId); }} testID="qandeel-shared-share-candidate"
            style={{ minHeight: MIN_TARGET, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: palette.markerThickness, borderColor: checked ? palette.selectedInk : palette.field }}>
            <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{author}</Text>
            <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{candidate.text}</Text>
          </Control>
        );
      }) : null}
      {candidates?.status === 'READY' && candidates.hasOlder ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.olderMessages} accessibilityState={{ busy: candidates.loadingOlder, disabled: candidates.loadingOlder }}
          onPress={() => { if (!candidates.loadingOlder) controller.loadOlderHistoryCandidates(); }} testID="qandeel-shared-share-older"
          style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.olderMessages}</Text>
        </Control>
      ) : null}
      {preview.length > 0 ? (
        <View testID="qandeel-shared-share-preview" style={{ rowGap: 4, paddingTop: 4 }}>
          <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{fill(copy.previewHeading, memberName)}</Text>
          {preview.map((item) => <Text key={item.materialId} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{item.text}</Text>)}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: busy }} onPress={() => { if (!busy) onClose(); }}
          testID="qandeel-shared-share-cancel" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
        </Control>
        {preview.length > 0 ? (
          <Control palette={palette} language={language} accessibilityLabel={copy.proposeShare} accessibilityState={{ busy, disabled: busy }}
            onPress={() => { if (!busy) void controller.proposeHistoryShare(memberHandle, preview.map((p) => p.materialId)).then((result) => { if (result === 'PROPOSED') onClose(); }); }}
            testID="qandeel-shared-share-propose" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.proposeShare}</Text>
          </Control>
        ) : null}
      </View>
    </View>
  );
}
