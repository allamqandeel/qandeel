/**
 * SHARED-VIS-01 — an open «العالم المشترك» / Shared World, analysed on the ONE Living Analysis surface.
 *
 * Shared is a consumer of the same screen the Personal Analysis and the Public World are (`LivingAnalysisSurface` →
 * `WorldViewSurface` → `WorldCanvas`), never a screen of its own. It brings its projection and its capabilities, and
 * nothing of the screen:
 *
 *   the Analysis place     — the surface's: always dark, on the Analysis ground;
 *   top band               — the World's own chrome: the way back to the Shared root, the World's label, the ONE clear
 *                            entry into the World's existing conversation (D7) and «إدارة العالم» / Manage World; the band's
 *                            measured height is the world's top inset;
 *   world                  — the World's semantic places in the measured world frame (`./SharedFieldView`), keyed by the
 *                            World so that nothing of one World's presentation can continue into another's;
 *   no temporal track      — no Shared Timeline in SHARED-VIS-01 (D5): the surface composes `CHROME_ONLY`; the World's
 *                            chronology stays durable on the server, and nothing of the Personal Timeline is borrowed;
 *   chrome band            — what the field says about where the reader is: the focused place's panel (its meaning,
 *                            themes and exact sources), or the field's empty / unavailable state.
 *
 * Members and QANDEEL are not drawn as objects in the World (D6): they stay in the conversation, with their attribution,
 * and in Manage World. Nothing here is a feed, a chat list or a ranking: no order of importance, no count, no line.
 *
 * COSMOS-INT-01 Slice D CP2 (Contract v1.5 §19, the PO's CP2 authorisation 2026-11-16): what the chrome band held — the
 * focused place's panel, the field's unavailable (+ Retry) and empty states — is now the COSMOS Detail Sheet's content
 * (CP1's one sheet), in the stage, under the top band (D-11). Its PEEK shows the content's top (the meaning and the
 * themes); EXPANDED shows it all: the exact sources under «مصادر هذا المعنى» (SD-6: no count), then the World's existing
 * Conversation act (SD-2: the same `openConversation()`; no source opens a place in the conversation, QAN-BL-CW-08).
 * PEEK / EXPANDED / CLOSED is presentation only (D-12): it releases no focus, writes no camera and reads nothing. The
 * area's ONE hardware Back handler asks the sheet first (`registerSheetBack`), then runs its order, unchanged.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { Control, Glyph, MIN_TARGET, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import {
  CosmosDetailSheet, CosmosSheetStage, CosmosWorldView, createSharedCosmosOwner, reopeningOwner, useDetailSheet, type CosmosWorldOwner, type DetailSheet, type SheetContent,
} from '../../cosmos/product';
import { LivingAnalysisSurface } from '../../living-analysis';
import { useSteadyEnvelope, viewportEnvelope, type ViewportEnvelope } from '../../map/camera';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import type { SharedFieldPlace } from '../../runtime-entry';
import { sharedFieldCopy, type SharedFieldCopy } from './field-copy';
import type { SharedFieldController, SharedFieldPanelState, SharedFieldState } from './shared-field-controller';
import { diagTextLayout } from '../../cosmos/__diag__/trace';

export const SHARED_FIELD_TEST_ID = 'qandeel-shared-field';
export const SHARED_BAND_TEST_ID = 'qandeel-shared-band';
/** COSMOS-INT-01: the stage's own test id, the one the old field view's world carried. */
export const SHARED_FIELD_WORLD_TEST_ID = 'qandeel-shared-field-world';
/** The band's height before its first measurement: the heading's and the controls' minimum rows. */
const BAND_SEED_HEIGHT = 48 + MIN_TARGET + 6;

export interface SharedLivingAnalysisProps {
  readonly controller: SharedFieldController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The World's label (its committed name, or the S4-01 member-name label). */
  readonly title: string;
  readonly onBack: () => void;
  readonly onConversation: () => void;
  readonly onManage: () => void;
  /**
   * Slice D (§19.6, SD-5): the sheet's step of the area's ONE hardware Back handler — handed to the area while this field
   * is shown (`null` when it leaves). It answers `true` when it dismissed something (EXPANDED → PEEK → CLOSED, presentation
   * only); the area then runs its own order, unchanged. No listener is registered here.
   */
  readonly registerSheetBack?: (back: (() => boolean) | null) => void;
}

export function SharedLivingAnalysis({ controller, language, insets, title, onBack, onConversation, onManage, registerSheetBack }: SharedLivingAnalysisProps) {
  const copy = sharedFieldCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);
  const [bandHeight, setBandHeight] = useState(insets.top + BAND_SEED_HEIGHT);
  // COSMOS-INT-01 Slice B: the COSMOS stage over THIS controller. One owner per (controller, language); it is the thin
  // seam that relays the fingers to the controller and reads its answers back, and it is retired with the screen.
  const [owner, setOwner] = useState(() => ({ controller, language, it: createSharedCosmosOwner(controller, language) }));
  if (owner.controller !== controller || owner.language !== language) setOwner({ controller, language, it: createSharedCosmosOwner(controller, language) });
  useEffect(() => () => owner.it.dispose(), [owner]);

  // Slice D: the Detail Sheet shows what the chrome band showed; how much of it is shown is presentation only (§19.4).
  const content = sheetContentOf(state);
  const sheet = useDetailSheet(content);
  const sheetBack = sheet.back;
  useEffect(() => {
    registerSheetBack?.(sheetBack);
    return () => registerSheetBack?.(null);
  }, [registerSheetBack, sheetBack]);

  return (
    <View testID={SHARED_FIELD_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface
        insets={insets}
        fontScale={screen.fontScale}
        envelope={presentedIn}
        top={{
          content: <SharedBand insets={insets} onHeight={setBandHeight} copy={copy} language={language} title={title}
            onBack={onBack} onConversation={onConversation} onManage={onManage} />,
          height: bandHeight,
        }}
        // COSMOS-INT-01 (D-2): the World's places as the COSMOS stage under the composition, keyed by the World so that
        // nothing of one World's presentation can continue into another's; Slice D: its Detail Sheet in it.
        stage={(glass) => (
          <SharedStage key={state.worldId ?? 'none'} owner={owner.it} glass={glass} camera={state.camera} copy={copy} language={language} sheet={sheet}
            subject={content?.group ?? null} accent={state.focus !== null}
            detail={<FieldChrome controller={controller} state={state} copy={copy} language={language} bottomInset={glass.insetBottom} onConversation={onConversation} />} />
        )}
        timeline={null}
        // Slice D: the chrome band measures nothing (CHROME_ONLY collapses to the safe area); the field speaks in the sheet.
        chrome={() => null}
      />
    </View>
  );
}

/**
 * The COSMOS stage of one World: the glass steadied by CA-O1, the approved field label and step words; and, in the same
 * stage after it (Slice D, exactly as Public's), the Detail Sheet over the field's content. The world view and its canvas
 * are never re-keyed by the sheet: while it is EXPANDED they stay mounted, take no touch, are hidden from accessibility
 * and do not drift (SD-11); while it is open, its PEEK's visible height is the glass's bottom inset (SD-10) — presentation
 * only: the Shared controller's `setEnvelope` records it and reads nothing.
 */
function SharedStage({ owner: seam, glass, camera, copy, language, sheet, subject, accent, detail }: {
  readonly owner: CosmosWorldOwner; readonly glass: ViewportEnvelope; readonly camera: SharedFieldState['camera'];
  readonly copy: SharedFieldCopy; readonly language: ChromeLanguage; readonly sheet: DetailSheet;
  readonly subject: string | null; readonly accent: boolean; readonly detail: ReactNode;
}) {
  // SD-12: a focus on the stage (a tap answered FOCUS, an accessible mark) shows a closed sheet again; the act is unchanged.
  const reopen = sheet.open;
  const owner = useMemo(() => reopeningOwner(seam, reopen), [seam, reopen]);
  const [peek, setPeek] = useState(0);
  const lifted = useMemo(() => (peek > glass.insetBottom
    ? viewportEnvelope(glass.width, glass.height, { top: glass.insetTop, right: glass.insetRight, bottom: peek, left: glass.insetLeft }) ?? glass
    : glass), [glass, peek]);
  // MAP-CLOSE-01 CA-O1: once the reader has acted, the world stays where it is when only the band below it changes.
  const steady = useSteadyEnvelope(lifted, camera);
  const expanded = sheet.phase === 'EXPANDED';
  return (
    <>
      <CosmosSheetStage expanded={expanded}>
        <CosmosWorldView owner={owner} world="SHARED" language={language} glass={steady} drift={!expanded} worldLabel={copy.fieldLabel}
          zoomInLabel={copy.moreDetail} zoomOutLabel={copy.lessDetail} testID={SHARED_FIELD_WORLD_TEST_ID} />
      </CosmosSheetStage>
      <CosmosDetailSheet phase={sheet.phase} onSettle={sheet.settle} glass={glass} language={language} allowExpanded subject={subject} accent={accent} onPeek={setPeek}>
        {detail}
      </CosmosDetailSheet>
    </>
  );
}

/**
 * Slice D (§19.4): WHAT the sheet shows, in the chrome band's own priority (`FieldChrome`), as an identity: one focused
 * place is one group (its panel loading, served or absent is the same subject); the field's unavailable and empty states
 * are groups of their own. Nothing to say (the field loading, or a World at rest with no focus): no content, and the
 * sheet closes.
 */
function sheetContentOf(state: SharedFieldState): SheetContent | null {
  if (state.focus !== null) return { key: `FOCUS:${state.focus.id}`, group: `FOCUS:${state.focus.id}` };
  if (state.status === 'UNAVAILABLE') return { key: 'UNAVAILABLE', group: 'UNAVAILABLE' };
  if (state.status === 'READY' && state.entries.length === 0) return { key: 'EMPTY', group: 'EMPTY' };
  return null;
}

/** The top band: the World's own chrome. It is measured, and its height is the world's top inset. */
function SharedBand({ insets, onHeight, copy, language, title, onBack, onConversation, onManage }: {
  readonly insets: SharedLivingAnalysisProps['insets']; readonly onHeight: (height: number) => void; readonly copy: SharedFieldCopy;
  readonly language: ChromeLanguage; readonly title: string; readonly onBack: () => void; readonly onConversation: () => void; readonly onManage: () => void;
}) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View testID={SHARED_BAND_TEST_ID} onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={{ backgroundColor: palette.world, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: 6 }}>
      <View style={{ paddingHorizontal: 10, minHeight: 48, flexDirection: 'row', alignItems: 'center', columnGap: 2 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-shared-back"
          style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text testID="qandeel-shared-title" accessibilityRole="header" accessibilityLanguage={language} numberOfLines={1} onTextLayout={diagTextLayout('sharedTitle', title)}
          style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, paddingHorizontal: 12 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.conversation} onPress={onConversation} testID="qandeel-shared-conversation-open"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.field }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.conversation}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={copy.manageWorld} onPress={onManage} testID="qandeel-shared-manage-open"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.manageWorld}</Text>
        </Control>
      </View>
    </View>
  );
}

/**
 * The Detail Sheet's content (Slice D; before, the chrome band's): one thing the field says at a time — the focused
 * place's panel, else the field's own state.
 */
function FieldChrome({ controller, state, copy, language, bottomInset, onConversation }: {
  readonly controller: SharedFieldController; readonly state: SharedFieldState; readonly copy: SharedFieldCopy;
  readonly language: ChromeLanguage; readonly bottomInset: number; readonly onConversation: () => void;
}) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  let content: ReactNode = null;
  if (state.focus !== null) {
    content = <Panel copy={copy} palette={palette} language={language} panel={state.focus.panel} onBack={() => controller.back()} onConversation={onConversation} />;
  } else if (state.status === 'UNAVAILABLE') {
    content = (
      <View style={{ alignItems: 'center', rowGap: 12, paddingTop: 12 }}>
        <Text testID="qandeel-shared-field-unavailable" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', writingDirection: writing }}>
          {copy.fieldUnavailable}
        </Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.revalidate()} testID="qandeel-shared-field-retry">
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.retry}</Text>
        </Control>
      </View>
    );
  } else if (state.status === 'READY' && state.entries.length === 0) {
    content = (
      <Text testID="qandeel-shared-field-empty" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', paddingTop: 12, writingDirection: writing }}>
        {copy.empty}
      </Text>
    );
  }
  if (content === null) return null;
  // Slice D: one surface. The sheet is the panel, so this content draws no card of its own (as Public's, CP1).
  return <View style={{ paddingHorizontal: 4, paddingTop: 2, paddingBottom: bottomInset + 8 }}>{content}</View>;
}

function Panel({ copy, palette, language, panel, onBack, onConversation }: {
  readonly copy: SharedFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly panel: SharedFieldPanelState; readonly onBack: () => void; readonly onConversation: () => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View testID="qandeel-shared-panel" accessibilityLanguage={language} style={{ paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-shared-panel-back">
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.back}</Text>
        </Control>
      </View>
      <View style={{ paddingHorizontal: 20, rowGap: 10 }}>
        {panel.status === 'SERVED' ? (
          <>
            <ServedPanel place={panel.place} copy={copy} palette={palette} language={language} />
            {/* SD-2 / G-3: the World's existing Conversation act, the same word and the same `openConversation()` as the
                band's. It opens the conversation as it is; no source opens its own place in it (QAN-BL-CW-08). */}
            <View style={{ flexDirection: 'row', paddingTop: 6 }}>
              <Control palette={palette} language={language} accessibilityLabel={copy.conversation} onPress={onConversation} testID="qandeel-shared-panel-conversation"
                style={{ minHeight: MIN_TARGET, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.field }}>
                <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.conversation}</Text>
              </Control>
            </View>
          </>
        ) : panel.status === 'LOADING' ? (
          <View accessible accessibilityState={{ busy: true }} style={{ minHeight: 48 }} />
        ) : (
          <Text testID="qandeel-shared-panel-absent" accessibilityLiveRegion="polite" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>
            {panel.status === 'ABSENT' ? copy.placeUnavailable : copy.fieldUnavailable}
          </Text>
        )}
      </View>
    </View>
  );
}

function ServedPanel({ place, copy, palette, language }: {
  readonly place: SharedFieldPlace; readonly copy: SharedFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  const separator = semanticListSeparator(language);
  return (
    <>
      <Text testID="qandeel-shared-panel-meaning" accessibilityRole="header" style={text('statement', palette.primary)}>{place.entry.meaning}</Text>
      {place.primaryThemes.length > 0 ? (
        <View style={{ rowGap: 2 }}>
          <Text style={text('metadata', palette.tertiary)}>{copy.primaryHeading}</Text>
          <Text style={text('supporting', palette.secondary)}>{place.primaryThemes.join(separator)}</Text>
        </View>
      ) : null}
      {place.secondaryThemes.length > 0 ? (
        <View style={{ rowGap: 2 }}>
          <Text style={text('metadata', palette.tertiary)}>{copy.secondaryHeading}</Text>
          <Text style={text('supporting', palette.secondary)}>{place.secondaryThemes.join(separator)}</Text>
        </View>
      ) : null}
      <View testID="qandeel-shared-panel-sources" style={{ rowGap: 6 }}>
        <Text style={text('metadata', palette.tertiary)}>{copy.sourcesHeading}</Text>
        {place.sources.map((source) => {
          const who = source.producer === 'SELF' ? copy.you : source.producer === 'QANDEEL' ? copy.qandeel : source.authorName ?? copy.someone;
          return (
            <View key={source.materialId} testID={`qandeel-shared-source-${source.materialId}`} accessible accessibilityLabel={`${who}: ${source.text}`}
              accessibilityLanguage={language} style={{ rowGap: 2 }}>
              <Text style={text('metadata', palette.secondary)}>{who}</Text>
              <Text style={text('body', palette.primary)}>{source.text}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}
