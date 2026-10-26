/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in a Shared World, on the existing Shared surfaces and
 * primitives (the conversation's `Control`, type scale and palette; no new design system):
 *
 *   - `SharedPermissionRequestCards`: the private request (CG-1) with «اسمح» / «لا» (CG-2), in the World's own screen,
 *     ABOVE and apart from the conversation — never a message, never in the thread, and drawn only from the reader's own
 *     read, so nobody else can see it or learn that it exists;
 *   - `SharedPermissionsSection`: «ما سمحت به هنا» / "What you've allowed here" in Manage World (CG-4) — the request, the
 *     allowed items with withdrawal, the reconfirmation when the audience grew (CG-3), the declined or withdrawn items with
 *     «اسمح الآن», and the ended ones (CG-5).
 *
 * Every word is the CP3 Copy Gate's (`./permissions-copy`, APPROVED 6/6). A consequence is stated BEFORE its act. Nothing
 * is shown while there is nothing of the reader's here: no empty state, no count, no badge.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ScrollView, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { SharedPermissionRequest, SharedPermissions } from '../../runtime-entry';
import { endedText, fillPermission, joinMembers, sharedPermissionsCopy, type SharedPermissionsCopy } from './permissions-copy';
import type { SharedPermissionsController, SharedPermissionsNotice } from './shared-permissions-controller';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;
const CARD_RADIUS = 14;

interface Shared {
  readonly copy: SharedPermissionsCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly writing: 'rtl' | 'ltr';
}

const noticeText = (copy: SharedPermissionsCopy, notice: SharedPermissionsNotice, world: string): string | null => {
  switch (notice) {
    case 'ALLOWED': return fillPermission(copy.allowedDone, { world });
    case 'DECLINED': return copy.declinedDone;
    case 'FAILED': return copy.actionUnavailable;
    default: return null;
  }
};

/** The surfaces only show: the Shared area reads the reader's permissions after the World's ALLOW, never a surface. */
function usePermissions(permissions: SharedPermissionsController) {
  return useSyncExternalStore(permissions.subscribe, permissions.getState);
}

function Button({ label, onPress, busy, emphasis = false, testID, s }: {
  readonly label: string; readonly onPress: () => void; readonly busy: boolean; readonly emphasis?: boolean; readonly testID: string; readonly s: Shared;
}) {
  return (
    <Control palette={s.palette} language={s.language} accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }}
      onPress={() => { if (!busy) onPress(); }} testID={testID}
      style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? s.palette.field : undefined, opacity: busy ? BUSY_OPACITY : 1 }}>
      <Text style={{ ...typeStyle('action'), color: emphasis ? s.palette.primary : s.palette.restInk }}>{label}</Text>
    </Control>
  );
}

function Notice({ text, error, s }: { readonly text: string | null; readonly error: boolean; readonly s: Shared }) {
  useEffect(() => {
    if (text !== null) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
  return (
    <View testID="qandeel-shared-permission-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
      {text === null ? null : (
        <Text style={{ ...typeStyle('supporting'), color: error ? s.palette.error : s.palette.secondary, paddingTop: 8, writingDirection: s.writing }}>{text}</Text>
      )}
    </View>
  );
}

/** CG-1 / CG-2: one private request, its four lines, then «اسمح» and «لا». With `linesMaxHeight`, only the lines scroll (bounded,
 *  their scrollbar always shown) and the two answers stay in sight beneath them. */
function RequestCard({ request, data, world, busyKey, permissions, s, linesMaxHeight }: {
  readonly request: SharedPermissionRequest; readonly data: SharedPermissions; readonly world: string; readonly busyKey: string | null;
  readonly permissions: SharedPermissionsController; readonly s: Shared; readonly linesMaxHeight?: number;
}) {
  const text = fillPermission(s.copy.request, { world, item: request.text, members: joinMembers(s.copy, data.members) });
  const busy = busyKey !== null;
  return (
    <View testID="qandeel-shared-permission-request" accessible={false}
      style={{ marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginTop: 12, padding: 14, rowGap: 10, borderRadius: CARD_RADIUS,
        borderWidth: s.palette.markerThickness, borderColor: s.palette.field }}>
      <ScrollView testID="qandeel-shared-permission-request-lines" scrollEnabled={linesMaxHeight !== undefined} persistentScrollbar
        style={{ flexGrow: 0, maxHeight: linesMaxHeight }} contentContainerStyle={{ rowGap: 10 }}>
        {text.split('\n').map((line, index) => (
          <Text key={index} testID={`qandeel-shared-permission-request-line-${index}`} accessibilityLanguage={s.language}
            style={{ ...typeStyle(index === 0 ? 'body' : 'supporting'), color: index === 0 ? s.palette.primary : s.palette.secondary, writingDirection: s.writing }}>
            {line}
          </Text>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
        <Button label={s.copy.allow} emphasis busy={busy} testID="qandeel-shared-permission-allow" s={s}
          onPress={() => { void permissions.answer(request.requestId, 'ALLOW'); }} />
        <Button label={s.copy.decline} busy={busy} testID="qandeel-shared-permission-decline" s={s}
          onPress={() => { void permissions.answer(request.requestId, 'DECLINE'); }} />
      </View>
    </View>
  );
}

/** At most this share of the window holds a pinned request's words; they scroll inside it, its answers stay in sight. */
const REQUEST_LINES_SHARE = 0.3;

/**
 * The World's own screen: the reader's private request(s), apart from the conversation. Nothing when there is none.
 * Pinned between the World's header and its conversation — never inside the conversation's scroll, so a long history
 * never carries it out of sight — and bounded, so the conversation and its composer stay usable beneath it. One request
 * at a time (the next once it is answered; Manage World lists them all), so «اسمح» and «لا» are always in sight.
 */
export function SharedPermissionRequestCards({ permissions, worldId, world, language, palette, insetLeft = 0, insetRight = 0 }: {
  readonly permissions: SharedPermissionsController;
  readonly worldId: string;
  /** The World's name as the reader sees it ({world}). */
  readonly world: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly insetLeft?: number;
  readonly insetRight?: number;
}) {
  const { height } = useWindowDimensions();
  const state = usePermissions(permissions);
  const s: Shared = { copy: sharedPermissionsCopy(language), language, palette, writing: language === 'ar' ? 'rtl' : 'ltr' };
  const data = state.worldId === worldId ? state.data : null;
  const said = state.worldId === worldId ? noticeText(s.copy, state.notice, world) : null;
  if ((data === null || data.requests.length === 0) && said === null) return null;
  return (
    <View testID="qandeel-shared-permission-requests" style={{ paddingBottom: 8, paddingLeft: insetLeft, paddingRight: insetRight }}>
      {data === null || data.requests.length === 0 ? null : (
        <RequestCard key={data.requests[0].requestId} request={data.requests[0]} data={data} world={world} busyKey={state.busy}
          permissions={permissions} s={s} linesMaxHeight={Math.round(height * REQUEST_LINES_SHARE)} />
      )}
      <Notice text={said} error={state.notice === 'FAILED'} s={s} />
    </View>
  );
}

type Confirming = { readonly kind: 'WITHDRAW' | 'ALLOW_NOW'; readonly itemId: string } | null;

/** A consequence stated BEFORE its act, then the way out and the act. Focus moves to the consequence. */
function Confirm({ explain, confirm, busy, testID, onCancel, onConfirm, s }: {
  readonly explain: string; readonly confirm: string; readonly busy: boolean; readonly testID: string;
  readonly onCancel: () => void; readonly onConfirm: () => void; readonly s: Shared;
}) {
  const explainRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = explainRef.current === null ? null : findNodeHandle(explainRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  return (
    <View testID={testID} style={{ rowGap: 8, paddingTop: 6 }}>
      <Text ref={explainRef} style={{ ...typeStyle('supporting'), color: s.palette.secondary, writingDirection: s.writing }}>{explain}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, marginStart: -16 }}>
        <Button label={s.copy.cancel} busy={busy} testID={`${testID}-cancel`} onPress={onCancel} s={s} />
        <Button label={confirm} emphasis busy={busy} testID={`${testID}-action`} onPress={onConfirm} s={s} />
      </View>
    </View>
  );
}

function ItemText({ text, s }: { readonly text: string; readonly s: Shared }) {
  return <Text accessibilityLanguage={s.language} style={{ ...typeStyle('body'), color: s.palette.primary, writingDirection: s.writing }}>{text}</Text>;
}

function SubHeading({ text, s }: { readonly text: string; readonly s: Shared }) {
  return (
    <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 14, paddingBottom: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

/** «ما سمحت به هنا» / "What you've allowed here" — in Manage World. Nothing when the reader has nothing here. */
export function SharedPermissionsSection({ permissions, worldId, world, language, palette }: {
  readonly permissions: SharedPermissionsController;
  readonly worldId: string;
  readonly world: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  const state = usePermissions(permissions);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const s: Shared = { copy: sharedPermissionsCopy(language), language, palette, writing: language === 'ar' ? 'rtl' : 'ltr' };
  const data = state.worldId === worldId ? state.data : null;
  const said = state.worldId === worldId ? noticeText(s.copy, state.notice, world) : null;
  const busy = state.busy !== null;
  if (data === null) return null;
  const allowedRows = data.allowed.length + data.reconfirm.length;
  if (data.requests.length + allowedRows + data.declined.length + data.ended.length === 0 && said === null) return null;
  const close = () => setConfirming(null);
  return (
    <View testID="qandeel-shared-permissions">
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: s.writing }}>
        {s.copy.title}
      </Text>
      {data.requests.map((request) => (
        <RequestCard key={request.requestId} request={request} data={data} world={world} busyKey={state.busy} permissions={permissions} s={s} />
      ))}
      <Notice text={said} error={state.notice === 'FAILED'} s={s} />

      {/* CG-3 first: what waits for the owner since the audience grew — no longer in use, so not under «مسموح». */}
      {data.reconfirm.map((item) => (
        <View key={`reconfirm-${item.itemId}`} testID="qandeel-shared-permission-reconfirm" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, rowGap: 6 }}>
          <Text accessibilityLanguage={language} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: s.writing }}>
            {fillPermission(s.copy.reconfirm, { world, members: joinMembers(s.copy, item.newMembers), item: item.text })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, marginStart: -16 }}>
            <Button label={s.copy.allowEveryone} emphasis busy={busy} testID="qandeel-shared-permission-allow-everyone" s={s} onPress={() => { void permissions.allow(item.itemId); }} />
            <Button label={s.copy.stopUsing} busy={busy} testID="qandeel-shared-permission-stop" s={s} onPress={() => { void permissions.withdraw(item.itemId); }} />
          </View>
        </View>
      ))}

      {data.allowed.length > 0 ? <SubHeading text={s.copy.allowedHeading} s={s} /> : null}
      {data.allowed.map((item) => (
        <View key={`allowed-${item.itemId}`} testID="qandeel-shared-permission-allowed" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, rowGap: 4 }}>
          <ItemText text={item.text} s={s} />
          {confirming?.kind === 'WITHDRAW' && confirming.itemId === item.itemId ? (
            <Confirm explain={fillPermission(s.copy.withdrawExplain, { world })} confirm={s.copy.withdrawConfirm} busy={busy} testID="qandeel-shared-permission-withdraw-confirm" s={s}
              onCancel={close} onConfirm={() => { void permissions.withdraw(item.itemId).then((kind) => { if (kind !== null && kind !== 'UNAVAILABLE') close(); }); }} />
          ) : (
            <View style={{ marginStart: -16 }}>
              <Button label={s.copy.withdraw} busy={busy} testID="qandeel-shared-permission-withdraw" s={s} onPress={() => setConfirming({ kind: 'WITHDRAW', itemId: item.itemId })} />
            </View>
          )}
        </View>
      ))}

      {data.declined.length > 0 ? <SubHeading text={s.copy.declinedHeading} s={s} /> : null}
      {data.declined.map((item) => (
        <View key={`declined-${item.itemId}`} testID="qandeel-shared-permission-declined" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, rowGap: 4 }}>
          <ItemText text={item.text} s={s} />
          {confirming?.kind === 'ALLOW_NOW' && confirming.itemId === item.itemId ? (
            <Confirm explain={fillPermission(s.copy.allowNowExplain, { members: joinMembers(s.copy, data.members) })} confirm={s.copy.allowNowConfirm} busy={busy}
              testID="qandeel-shared-permission-allow-now-confirm" s={s}
              onCancel={close} onConfirm={() => { void permissions.allow(item.itemId).then((kind) => { if (kind === 'ALLOWED' || kind === 'REFUSED') close(); }); }} />
          ) : (
            <View style={{ marginStart: -16 }}>
              <Button label={s.copy.allowNow} busy={busy} testID="qandeel-shared-permission-allow-now" s={s} onPress={() => setConfirming({ kind: 'ALLOW_NOW', itemId: item.itemId })} />
            </View>
          )}
        </View>
      ))}

      {data.ended.map((item, index) => (
        <View key={`ended-${item.itemId}-${index}`} testID="qandeel-shared-permission-ended" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6, rowGap: 2 }}>
          {item.text === null ? null : <Text accessibilityLanguage={language} style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: s.writing }}>{item.text}</Text>}
          <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: s.writing }}>{endedText(s.copy, item.reason)}</Text>
        </View>
      ))}
    </View>
  );
}
