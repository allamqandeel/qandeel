/**
 * S5-03B R2 — «العالم العام» / Public World analysed on the ONE Living Analysis surface.
 *
 * Public is a consumer of the same screen the Personal Analysis is (`LivingAnalysisSurface` → `WorldViewSurface` →
 * `WorldCanvas`), never a screen of its own. It brings its projection and its capabilities, and nothing of the screen:
 *
 *   the Analysis place     — the surface's: always dark, on the Analysis ground (D1);
 *   top band               — the Public World's own heading (its name, the Activity entry, the way into authoring) and
 *                            the search over the same field (D4); the band's measured height is the world's top inset;
 *   world                  — the Public field in the measured world frame (`./PublicFieldView`);
 *   no temporal track      — the Public field has no time to navigate: no Timeline, no Live, no Return-to-Live. The
 *                            surface composes `CHROME_ONLY`, so the world frame is exactly the one every world gets;
 *   chrome band            — what the field says about where the reader is (D2): the focused Experience's contextual
 *                            panel and its nearby context; the search results while no Experience is chosen (a chosen
 *                            result folds them away, Back returns to them); the field's empty or unavailable state.
 *
 * Semantic Zoom changes disclosure over the SAME field — FAR mass, MID legible places, NEAR one focused Experience —
 * by the surface's one drag and one semantic step (pinch, or the accessible actions of the world's container). There
 * are no visible zoom controls (D3). Nothing here is a feed, a card wall, a category browser or a popularity map: no
 * order of importance, no view count, no line between Experiences, and an empty World is shown as empty.
 *
 * Back is local (see the controller): it is registered only while the panel or the search is open; at the World's
 * root nothing is registered.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Control, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import { LivingAnalysisSurface } from '../../living-analysis';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import type { PublicFieldExperience } from '../../runtime-entry';
import { fillPublicFieldCopy, publicFieldCopy, type PublicFieldCopy } from './field-copy';
import { PUBLIC_SEARCH_QUERY_MAX, type PublicFieldController, type PublicFieldPanelState, type PublicFieldState } from './public-field-controller';
import { PublicFieldView } from './PublicFieldView';

export const PUBLIC_FIELD_TEST_ID = 'qandeel-public-field';
export const PUBLIC_BAND_TEST_ID = 'qandeel-public-band';
/** The band's height before its first measurement: the heading's and the search field's minimum rows. */
const BAND_SEED_HEIGHT = 48 + 44 + 10;

export interface PublicLivingAnalysisProps {
  readonly controller: PublicFieldController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The Public World's heading (its name, the Activity entry, the way into authoring), read first in the top band. */
  readonly heading: ReactNode;
}

export function PublicLivingAnalysis({ controller, language, insets, heading }: PublicLivingAnalysisProps) {
  const copy = publicFieldCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);
  const [bandHeight, setBandHeight] = useState(insets.top + BAND_SEED_HEIGHT);
  const [query, setQuery] = useState('');

  // Entering the field asks the server again; a previous visit is never kept (nothing is inherited, from anywhere).
  useEffect(() => {
    controller.enter();
  }, [controller]);

  // Local Back: the panel (focus), then the search. At the World's root nothing is registered.
  const local = state.focus !== null || state.search.open;
  useEffect(() => {
    if (!local) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => controller.back());
    return () => subscription.remove();
  }, [controller, local]);

  return (
    <View testID={PUBLIC_FIELD_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface
        insets={insets}
        fontScale={screen.fontScale}
        envelope={presentedIn}
        top={{
          content: (
            <PublicBand insets={insets} onHeight={setBandHeight} heading={heading}>
              <SearchRow controller={controller} state={state} copy={copy} language={language} query={query} setQuery={setQuery} />
            </PublicBand>
          ),
          height: bandHeight,
        }}
        world={(envelope) => <PublicFieldView controller={controller} state={state} envelope={envelope} copy={copy} language={language} />}
        timeline={null}
        chrome={(composition) => <FieldChrome controller={controller} state={state} copy={copy} language={language} bottomInset={composition.bottomInset} />}
      />
    </View>
  );
}

/** The top band: the Public heading, then the search. It is measured, and its height is the world's top inset. */
function PublicBand({ insets, onHeight, heading, children }: {
  readonly insets: PublicLivingAnalysisProps['insets']; readonly onHeight: (height: number) => void; readonly heading: ReactNode; readonly children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View testID={PUBLIC_BAND_TEST_ID} onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={{ backgroundColor: palette.world, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: 6, rowGap: 4 }}>
      {heading}
      {children}
    </View>
  );
}

function SearchRow({ controller, state, copy, language, query, setQuery }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly copy: PublicFieldCopy;
  readonly language: ChromeLanguage; readonly query: string; readonly setQuery: (value: string) => void;
}) {
  const palette = usePalette();
  const { search } = state;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, paddingHorizontal: 12 }}>
      {/* A closed search shows no query: closing it — by its own control or by Back — leaves nothing typed behind. */}
      <TextInput testID="qandeel-public-search" value={search.open ? query : ''} onChangeText={setQuery}
        onFocus={() => { if (!search.open) setQuery(''); controller.openSearch(); }}
        onSubmitEditing={() => controller.search(query)} returnKeyType="search" maxLength={PUBLIC_SEARCH_QUERY_MAX}
        accessibilityLabel={copy.searchLabel} placeholder={copy.searchLabel} placeholderTextColor={palette.tertiary} accessibilityLanguage={language}
        selectionColor={palette.primary} cursorColor={palette.primary}
        style={{ ...typeStyle('body'), flex: 1, minHeight: 44, color: palette.primary, backgroundColor: palette.field, borderRadius: 22,
          paddingHorizontal: 16, writingDirection: writing, textAlign: writing === 'rtl' ? 'right' : 'left' }} />
      {search.open ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.cancel} testID="qandeel-public-search-close"
          onPress={() => { setQuery(''); Keyboard.dismiss(); controller.closeSearch(); }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
        </Control>
      ) : null}
    </View>
  );
}

/**
 * The chrome band's content: one thing the field says at a time. The focused Experience's panel; else the open search's
 * results (folded away once a result is chosen, so they never cover the panel); else the field's own state.
 */
function FieldChrome({ controller, state, copy, language, bottomInset }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly copy: PublicFieldCopy;
  readonly language: ChromeLanguage; readonly bottomInset: number;
}) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const { search } = state;
  const resultsShown = search.open && state.focus === null && (search.status === 'RESULTS' || search.status === 'NONE' || search.status === 'UNAVAILABLE');
  let content: ReactNode = null;
  if (state.focus !== null) {
    content = <Panel copy={copy} palette={palette} language={language} panel={state.focus.panel} onBack={() => controller.back()} onFocus={(id) => controller.focus(id)} />;
  } else if (resultsShown) {
    content = (
      <View testID="qandeel-public-search-results" style={{ backgroundColor: palette.field, borderRadius: 16, paddingVertical: 4 }}>
        {search.status === 'RESULTS' ? search.results.map((entry) => (
          <Pressable key={entry.id} testID={`qandeel-public-search-result-${entry.id}`} accessibilityRole="button" accessibilityLabel={entry.meaning}
            accessibilityLanguage={language} onPress={() => { Keyboard.dismiss(); controller.focus(entry.id); }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text numberOfLines={1} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{entry.meaning}</Text>
          </Pressable>
        )) : (
          <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, padding: 16, writingDirection: writing }}>
            {search.status === 'NONE' ? copy.noResults : copy.fieldUnavailable}
          </Text>
        )}
      </View>
    );
  } else if (state.status === 'UNAVAILABLE') {
    content = (
      <View style={{ alignItems: 'center', rowGap: 12, paddingTop: 12 }}>
        <Text testID="qandeel-public-field-unavailable" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', writingDirection: writing }}>
          {copy.fieldUnavailable}
        </Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.enter()} testID="qandeel-public-field-retry">
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.retry}</Text>
        </Control>
      </View>
    );
  } else if (state.status === 'READY' && state.entries.length === 0 && !search.open) {
    content = (
      <Text testID="qandeel-public-field-empty" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', paddingTop: 12, writingDirection: writing }}>
        {copy.empty}
      </Text>
    );
  }
  if (content === null) return null;
  return <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: bottomInset + 8 }}>{content}</View>;
}

function Panel({ copy, palette, language, panel, onBack, onFocus }: {
  readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly panel: PublicFieldPanelState; readonly onBack: () => void; readonly onFocus: (id: string) => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement' | 'action', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <View testID="qandeel-public-panel" accessibilityLanguage={language} style={{ backgroundColor: palette.field, borderRadius: 20, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-public-panel-back">
          <Text style={text('action', palette.restInk)}>{copy.back}</Text>
        </Control>
      </View>
      <View style={{ paddingHorizontal: 20, rowGap: 10 }}>
        {panel.status === 'SERVED' ? (
          <ServedPanel experience={panel.experience} copy={copy} palette={palette} language={language} onFocus={onFocus} />
        ) : panel.status === 'LOADING' ? (
          <View accessible accessibilityState={{ busy: true }} style={{ minHeight: 48 }} />
        ) : (
          <Text testID="qandeel-public-panel-absent" accessibilityLiveRegion="polite" style={text('body', palette.secondary)}>
            {panel.status === 'ABSENT' ? copy.experienceUnavailable : copy.fieldUnavailable}
          </Text>
        )}
      </View>
    </View>
  );
}

function ServedPanel({ experience, copy, palette, language, onFocus }: {
  readonly experience: PublicFieldExperience; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette;
  readonly language: ChromeLanguage; readonly onFocus: (id: string) => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <>
      <Text testID="qandeel-public-panel-meaning" accessibilityRole="header" style={text('statement', palette.primary)}>{experience.entry.meaning}</Text>
      {experience.publisher.label !== null ? (
        <Text style={text('metadata', palette.secondary)}>{fillPublicFieldCopy(copy.sharedBy, experience.publisher.label)}</Text>
      ) : null}
      <Themes heading={copy.primaryHeading} themes={experience.primaryThemes} palette={palette} language={language} />
      <Themes heading={copy.secondaryHeading} themes={experience.secondaryThemes} palette={palette} language={language} />
      {experience.content.map((item) => (
        <View key={item.ordinal} style={{ rowGap: 2 }}>
          {item.kind === 'ANALYSIS' ? <Text style={text('metadata', palette.tertiary)}>{copy.analysisItem}</Text> : null}
          <Text style={text('body', palette.primary)}>{item.text}</Text>
        </View>
      ))}
      {experience.nearby.length > 0 ? (
        <View style={{ rowGap: 2 }}>
          <Text style={text('metadata', palette.tertiary)}>{copy.nearHeading}</Text>
          {experience.nearby.map((near) => (
            <Pressable key={near.id} testID={`qandeel-public-nearby-${near.id}`} accessibilityRole="button" accessibilityLabel={near.meaning}
              accessibilityLanguage={language} onPress={() => onFocus(near.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={text('body', palette.secondary)}>{near.meaning}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function Themes({ heading, themes, palette, language }: {
  readonly heading: string; readonly themes: readonly string[]; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
}) {
  if (themes.length === 0) return null;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View style={{ rowGap: 2 }}>
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{heading}</Text>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{themes.join(semanticListSeparator(language))}</Text>
    </View>
  );
}
