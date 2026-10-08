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
 */
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { Control, Glyph, MIN_TARGET, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import { LivingAnalysisSurface } from '../../living-analysis';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import type { SharedFieldPlace } from '../../runtime-entry';
import { sharedFieldCopy, type SharedFieldCopy } from './field-copy';
import type { SharedFieldController, SharedFieldPanelState, SharedFieldState } from './shared-field-controller';
import { SharedFieldView } from './SharedFieldView';

export const SHARED_FIELD_TEST_ID = 'qandeel-shared-field';
export const SHARED_BAND_TEST_ID = 'qandeel-shared-band';
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
}

export function SharedLivingAnalysis({ controller, language, insets, title, onBack, onConversation, onManage }: SharedLivingAnalysisProps) {
  const copy = sharedFieldCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);
  const [bandHeight, setBandHeight] = useState(insets.top + BAND_SEED_HEIGHT);

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
        world={(envelope) => (
          <SharedFieldView key={state.worldId ?? 'none'} controller={controller} state={state} envelope={envelope} copy={copy} language={language} />
        )}
        timeline={null}
        chrome={(composition) => <FieldChrome controller={controller} state={state} copy={copy} language={language} bottomInset={composition.bottomInset} />}
      />
    </View>
  );
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
        <Text testID="qandeel-shared-title" accessibilityRole="header" accessibilityLanguage={language} numberOfLines={1}
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

/** The chrome band's content: one thing the field says at a time — the focused place's panel, else the field's own state. */
function FieldChrome({ controller, state, copy, language, bottomInset }: {
  readonly controller: SharedFieldController; readonly state: SharedFieldState; readonly copy: SharedFieldCopy;
  readonly language: ChromeLanguage; readonly bottomInset: number;
}) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  let content: ReactNode = null;
  if (state.focus !== null) {
    content = <Panel copy={copy} palette={palette} language={language} panel={state.focus.panel} onBack={() => controller.back()} />;
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
  return <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: bottomInset + 8 }}>{content}</View>;
}

function Panel({ copy, palette, language, panel, onBack }: {
  readonly copy: SharedFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly panel: SharedFieldPanelState; readonly onBack: () => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View testID="qandeel-shared-panel" accessibilityLanguage={language} style={{ backgroundColor: palette.field, borderRadius: 20, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-shared-panel-back">
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.back}</Text>
        </Control>
      </View>
      <View style={{ paddingHorizontal: 20, rowGap: 10 }}>
        {panel.status === 'SERVED' ? (
          <ServedPanel place={panel.place} copy={copy} palette={palette} language={language} />
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
