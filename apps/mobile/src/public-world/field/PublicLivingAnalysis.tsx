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
 *
 * S8A-05 CP1 — the reader may look at ONE section of the same field (WP1 §2.5): one small control in the top band names
 * the section shown («كل الأقسام ▾» by default) and opens their list in the chrome band; choosing one lets the other
 * topics recede (the field stays where it is), searches inside it (with «في: …» and a way back to every section), and
 * shows up to three of its topics nearest the centre of the glass. Nothing ranks, counts or moves.
 *
 * S5-04: the panel carries the Experience's publication date and its ONE dependent Discussion entry («النقاش · n» — the
 * human discussion count only; never QANDEEL's, never a ranking). Opening it draws the discussion in the same chrome band,
 * over the same panel; Back returns to the panel, then the field. Counts never move anything in the field.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Control, typeStyle, usePalette, type ConversationPalette } from '../../conversation';
import { LivingAnalysisSurface } from '../../living-analysis';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import { formatDay } from '../../settings/PrivacyDataSection';
import type { PublicFieldExperience } from '../../runtime-entry';
import { PUBLIC_TOPIC_SECTIONS, publicEntryLabel } from '../../runtime-entry';
import { fillCompose, publicComposeCopy } from '../../public-compose/copy';
import { nearestOf } from './public-field-camera';
import { fillDiscussionCopy, publicDiscussionCopy } from './discussion-copy';
import { fillPublicFieldCopy, publicFieldCopy, type PublicFieldCopy } from './field-copy';
import { PublicDiscussion } from './PublicDiscussion';
import { PUBLIC_SEARCH_QUERY_MAX, type PublicFieldController, type PublicFieldPanelState, type PublicFieldState } from './public-field-controller';
import { PublicFieldView } from './PublicFieldView';

export const PUBLIC_FIELD_TEST_ID = 'qandeel-public-field';
export const PUBLIC_BAND_TEST_ID = 'qandeel-public-band';
/** S8A-05 CP1: the most topics of the chosen section listed near the centre of the glass (WP1 §2.5 item 5). */
const SECTION_NEAR_MAX = 3;
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

  // Local Back: the section list, the panel (focus), the search, then the chosen section. At the World's root nothing is registered.
  const local = state.focus !== null || state.search.open || state.section.choosing || state.section.key !== null;
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
              {/* S8A-05 CP1: the section row under the search — the section shown while the search is closed, its scope while open. */}
              <SectionControl controller={controller} state={state} language={language} />
              <SearchScope controller={controller} state={state} language={language} />
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
 * S8A-05 CP1 — the one small control naming the section shown; it opens the list of sections. It stands on its own row at
 * the start, under the search, so the search keeps its whole width (device check, R2); it gives way while a search is open.
 */
function SectionControl({ controller, state, language }: { readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  if (state.search.open) return null;
  const words = publicComposeCopy(language);
  const shown = state.section.key === null ? words.allSections : words.section(state.section.key);
  return (
    <View style={{ alignItems: 'flex-start', paddingHorizontal: 12 }}>
      <Control palette={palette} language={language} accessibilityLabel={fillCompose(words.sectionShown, shown)} testID="qandeel-public-section-control"
        accessibilityState={{ expanded: state.section.choosing, disabled: state.status !== 'READY' }} onPress={() => { Keyboard.dismiss(); controller.openSections(); }}
        style={{ paddingHorizontal: 10 }}>
        <Text numberOfLines={1} style={{ ...typeStyle('supporting'), color: state.section.key === null ? palette.restInk : palette.primary }}>{`${shown} ▾`}</Text>
      </Control>
    </View>
  );
}

/** S8A-05 CP1 — while a search runs inside one section: «في: …» and the way back to every section. */
function SearchScope({ controller, state, language }: { readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  if (!state.search.open || state.section.key === null) return null;
  const words = publicComposeCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View testID="qandeel-public-search-scope" style={{ flexDirection: 'row', alignItems: 'center', columnGap: 4, paddingHorizontal: 16 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, flexShrink: 1, writingDirection: writing }}>{fillCompose(words.inSection, words.section(state.section.key))}</Text>
      <Control palette={palette} language={language} accessibilityLabel={words.showAllSections} testID="qandeel-public-search-scope-clear"
        onPress={() => controller.chooseSection(null)} style={{ paddingHorizontal: 12 }}>
        <Text style={{ ...typeStyle('action'), color: palette.restInk }}>✕</Text>
      </Control>
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
  if (state.section.choosing) {
    content = <SectionList controller={controller} state={state} copy={copy} language={language} />;
  } else if (state.focus !== null && state.focus.discussion === true && controller.discussion !== null) {
    content = <PublicDiscussion controller={controller.discussion} language={language} onBack={() => controller.closeDiscussion()} />;
  } else if (state.focus !== null) {
    content = <Panel copy={copy} palette={palette} language={language} panel={state.focus.panel} onBack={() => controller.back()} onFocus={(id) => controller.focus(id)}
      onDiscussion={controller.discussion !== null ? () => controller.openDiscussion() : null} />;
  } else if (resultsShown) {
    content = (
      <View testID="qandeel-public-search-results" style={{ backgroundColor: palette.field, borderRadius: 16, paddingVertical: 4 }}>
        {search.status === 'RESULTS' ? search.results.map((entry) => (
          <Pressable key={entry.id} testID={`qandeel-public-search-result-${entry.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(entry)}
            accessibilityLanguage={language} onPress={() => { Keyboard.dismiss(); controller.focus(entry.id); }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text numberOfLines={1} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{publicEntryLabel(entry)}</Text>
          </Pressable>
        )) : (
          <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, padding: 16, writingDirection: writing }}>
            {search.status === 'NONE' ? copy.noResults : copy.fieldUnavailable}
          </Text>
        )}
      </View>
    );
  } else if (state.status === 'READY' && state.section.key !== null && !search.open && state.camera !== null) {
    content = <SectionNear controller={controller} state={state} language={language} />;
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

/** S8A-05 CP1 — the list of sections («كل الأقسام» first), names only: no count, no order but the catalogue's. */
function SectionList({ controller, state, copy, language }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly copy: PublicFieldCopy; readonly language: ChromeLanguage;
}) {
  const palette = usePalette();
  const words = publicComposeCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const options: readonly { readonly key: (typeof PUBLIC_TOPIC_SECTIONS)[number] | null; readonly label: string }[] =
    [{ key: null, label: words.allSections }, ...PUBLIC_TOPIC_SECTIONS.map((key) => ({ key, label: words.section(key) }))];
  return (
    <View testID="qandeel-public-sections" style={{ backgroundColor: palette.field, borderRadius: 20, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={() => controller.closeSections()} testID="qandeel-public-sections-back">
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.back}</Text>
        </Control>
        <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingHorizontal: 8, writingDirection: writing }}>{words.sectionsHeading}</Text>
      </View>
      {/* The chrome band scrolls what it holds; the list adds no geometry of its own. */}
      <View accessibilityRole="radiogroup">
        {options.map((option) => {
          const chosen = option.key === state.section.key;
          return (
            <Pressable key={option.key ?? 'all'} testID={`qandeel-public-section-${option.key ?? 'all'}`} accessibilityRole="radio" accessibilityLabel={option.label}
              accessibilityLanguage={language} accessibilityState={{ checked: chosen }} onPress={() => controller.chooseSection(option.key)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 }}>
              <Text style={{ ...typeStyle('body'), color: chosen ? palette.primary : palette.secondary, writingDirection: writing }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** S8A-05 CP1 — up to three topics of the chosen section nearest the centre of the glass (by distance alone). */
function SectionNear({ controller, state, language }: { readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const words = publicComposeCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const key = state.section.key;
  const camera = state.camera;
  if (key === null || camera === null) return null;
  const inSection = state.entries.filter((entry) => entry.section === key);
  const near = nearestOf(camera.anchor, inSection, SECTION_NEAR_MAX).map((id) => inSection.find((entry) => entry.id === id)!);
  return (
    <View testID="qandeel-public-section-near" style={{ backgroundColor: palette.field, borderRadius: 16, paddingVertical: 4 }}>
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingHorizontal: 16, paddingTop: 8, writingDirection: writing }}>
        {near.length > 0 ? words.sectionNear : words.sectionNoneHere}
      </Text>
      {near.map((entry) => (
        <Pressable key={entry.id} testID={`qandeel-public-section-near-${entry.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(entry)}
          accessibilityLanguage={language} onPress={() => controller.focus(entry.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text numberOfLines={1} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{publicEntryLabel(entry)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Panel({ copy, palette, language, panel, onBack, onFocus, onDiscussion }: {
  readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly panel: PublicFieldPanelState; readonly onBack: () => void; readonly onFocus: (id: string) => void;
  readonly onDiscussion: (() => void) | null;
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
          <ServedPanel experience={panel.experience} copy={copy} palette={palette} language={language} onFocus={onFocus} onDiscussion={onDiscussion} />
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

function ServedPanel({ experience, copy, palette, language, onFocus, onDiscussion }: {
  readonly experience: PublicFieldExperience; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette;
  readonly language: ChromeLanguage; readonly onFocus: (id: string) => void; readonly onDiscussion: (() => void) | null;
}) {
  const discussionCopy = publicDiscussionCopy(language);
  const discussionLabel = experience.discussionCount > 0
    ? fillDiscussionCopy(discussionCopy.discussionWithCount, String(experience.discussionCount)) : discussionCopy.discussion;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <>
      {/* S8A-05 CP1: a topic its author wrote is shown by its human title, never by QANDEEL's meaning; then its section. */}
      <Text testID="qandeel-public-panel-meaning" accessibilityRole="header" style={text('statement', palette.primary)}>{publicEntryLabel(experience.entry)}</Text>
      {experience.entry.section !== undefined ? (
        <Text testID="qandeel-public-panel-section" style={text('metadata', palette.secondary)}>{publicComposeCopy(language).section(experience.entry.section)}</Text>
      ) : null}
      {experience.publisher.label !== null ? (
        <Text style={text('metadata', palette.secondary)}>{fillPublicFieldCopy(copy.sharedBy, experience.publisher.label)}</Text>
      ) : null}
      <Text testID="qandeel-public-panel-published" style={text('metadata', palette.tertiary)}>
        {fillDiscussionCopy(discussionCopy.publishedOn, formatDay(experience.publishedAt, language))}
      </Text>
      {onDiscussion !== null ? (
        <Control palette={palette} language={language} accessibilityLabel={discussionLabel} onPress={onDiscussion} testID="qandeel-public-panel-discussion"
          style={{ alignSelf: 'flex-start' }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{discussionLabel}</Text>
        </Control>
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
            <Pressable key={near.id} testID={`qandeel-public-nearby-${near.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(near)}
              accessibilityLanguage={language} onPress={() => onFocus(near.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={text('body', palette.secondary)}>{publicEntryLabel(near)}</Text>
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
