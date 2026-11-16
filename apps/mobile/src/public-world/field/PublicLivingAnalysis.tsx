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
 *
 * COSMOS-INT-01 Slice D (Contract v1.5 §19, CP1): what the chrome band held — the section list, the discussion, the
 * focused Experience's panel, the results, the field's states, in the same priority — is now the COSMOS Detail Sheet's
 * content, in the stage, under the top band (D-11). The sheet's PEEK / EXPANDED / CLOSED is presentation only (D-12):
 * collapsing or closing it releases no focus, writes no camera and reads nothing. The ONE hardware Back handler asks
 * the sheet first (EXPANDED → PEEK → CLOSED), then the controller's local Back, unchanged.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Control, typeStyle, usePalette, withAlpha, type ConversationPalette } from '../../conversation';
import {
  CosmosDetailSheet, CosmosSheetStage, CosmosWorldView, createPublicCosmosOwner, reopeningOwner, useDetailSheet, type CosmosWorldOwner, type DetailSheet, type SheetContent,
} from '../../cosmos/product';
import { LivingAnalysisSurface } from '../../living-analysis';
import { useSteadyEnvelope, viewportEnvelope, type ViewportEnvelope } from '../../map/camera';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import { formatDay } from '../../settings/PrivacyDataSection';
import type { PublicFieldExperience } from '../../runtime-entry';
import { PUBLIC_TOPIC_SECTIONS, publicEntryLabel } from '../../runtime-entry';
import { fillCompose, publicComposeCopy } from '../../public-compose/copy';
import { nearestOf, type PublicFieldCamera } from './public-field-camera';
import { fillDiscussionCopy, publicDiscussionCopy } from './discussion-copy';
import { fillPublicFieldCopy, publicFieldCopy, type PublicFieldCopy } from './field-copy';
import { PublicDiscussion } from './PublicDiscussion';
import { PublicTopicContent } from './PublicTopicContent';
import { PUBLIC_SEARCH_QUERY_MAX, type PublicFieldController, type PublicFieldPanelState, type PublicFieldState } from './public-field-controller';

export const PUBLIC_FIELD_TEST_ID = 'qandeel-public-field';
export const PUBLIC_BAND_TEST_ID = 'qandeel-public-band';
/** COSMOS-INT-01: the stage's own test id, the one the old field view's world carried. */
export const PUBLIC_FIELD_WORLD_TEST_ID = 'qandeel-public-field-world';
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
  // COSMOS-INT-01 Slice B: the COSMOS stage over THIS controller. One owner per (controller, language); it is the thin
  // seam that relays the fingers to the controller and reads its answers back, and it is retired with the screen. It
  // is made before the entry below, so the entry's own whole-world read is the evidence it keeps (Problem 7).
  const [owner, setOwner] = useState(() => ({ controller, language, it: createPublicCosmosOwner(controller, language) }));
  if (owner.controller !== controller || owner.language !== language) setOwner({ controller, language, it: createPublicCosmosOwner(controller, language) });
  useEffect(() => () => owner.it.dispose(), [owner]);

  // Entering the field asks the server again; a previous visit is never kept (nothing is inherited, from anywhere).
  useEffect(() => {
    controller.enter();
  }, [controller]);

  // Slice D: the Detail Sheet shows what the chrome band showed; how much of it is shown is presentation only (§19.4).
  const content = sheetContentOf(controller, state);
  const sheet = useDetailSheet(content);
  // Local Back (§19.6, ONE handler): the open sheet first (EXPANDED → PEEK → CLOSED, presentation only), then the
  // controller's own order — the section list, the panel (focus), the search, then the chosen section. At the World's
  // root, with the sheet closed, nothing is registered.
  const sheetBack = sheet.back;
  const local = sheet.phase !== 'CLOSED' || state.focus !== null || state.search.open || state.section.choosing || state.section.key !== null;
  useEffect(() => {
    if (!local) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => sheetBack() || controller.back());
    return () => subscription.remove();
  }, [controller, local, sheetBack]);

  return (
    <View testID={PUBLIC_FIELD_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface
        insets={insets}
        fontScale={screen.fontScale}
        envelope={presentedIn}
        top={{
          content: (
            <PublicBand insets={insets} onHeight={setBandHeight} heading={heading}>
              <SearchRow controller={controller} state={state} copy={copy} language={language} query={query} setQuery={setQuery} onShow={sheet.open} />
              {/* S8A-05 CP1: the section row under the search — the section shown while the search is closed, its scope while open. */}
              <SectionControl controller={controller} state={state} language={language} onShow={sheet.open} />
              <SearchScope controller={controller} state={state} language={language} />
            </PublicBand>
          ),
          height: bandHeight,
        }}
        // COSMOS-INT-01 (D-2): the Public field as the COSMOS stage under the composition; Slice D: its Detail Sheet in it.
        stage={(glass) => <PublicStage owner={owner.it} glass={glass} camera={state.camera} copy={copy} language={language} sheet={sheet}
          discussion={state.focus?.discussion === true && controller.discussion !== null} subject={content?.group ?? null} accent={state.focus !== null}
          detail={<FieldChrome controller={controller} state={state} copy={copy} language={language} bottomInset={glass.insetBottom} />} />}
        timeline={null}
        // Slice D: the chrome band measures nothing (CHROME_ONLY collapses to the safe area); the field speaks in the sheet.
        chrome={() => null}
      />
    </View>
  );
}

/**
 * The COSMOS stage of the Public field: the glass steadied by CA-O1, the approved field label and step words; and, in
 * the same stage after it (Slice D), the Detail Sheet over the field's content. The world view and its canvas are never
 * re-keyed by the sheet: while it is EXPANDED they stay mounted, take no touch, are hidden from accessibility and do not
 * drift (SD-11); while it is open, its PEEK's visible height is the glass's bottom inset (SD-10) — presentation only.
 */
function PublicStage({ owner: seam, glass, camera, copy, language, sheet, discussion, subject, accent, detail }: {
  readonly owner: CosmosWorldOwner; readonly glass: ViewportEnvelope; readonly camera: PublicFieldCamera | null;
  readonly copy: PublicFieldCopy; readonly language: ChromeLanguage; readonly sheet: DetailSheet; readonly discussion: boolean;
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
        <CosmosWorldView owner={owner} world="PUBLIC" language={language} glass={steady} drift={!expanded} worldLabel={copy.fieldLabel}
          zoomInLabel={copy.moreDetail} zoomOutLabel={copy.lessDetail} testID={PUBLIC_FIELD_WORLD_TEST_ID} />
      </CosmosSheetStage>
      <CosmosDetailSheet phase={sheet.phase} onSettle={sheet.settle} glass={glass} language={language} allowExpanded bodyDrags={!discussion}
        subject={subject} accent={accent} onPeek={setPeek}>
        {detail}
      </CosmosDetailSheet>
    </>
  );
}

/**
 * Slice D (§19.4): WHAT the sheet shows, in the chrome band's own priority (`FieldChrome`), as an identity. One focused
 * Experience is one group, its panel and its discussion two contents of it (the discussion is read EXPANDED); the
 * results, the section list, the section's near topics and the field's states are groups of their own. Nothing to say:
 * no content, and the sheet closes.
 */
function sheetContentOf(controller: PublicFieldController, state: PublicFieldState): SheetContent | null {
  const { search } = state;
  if (state.section.choosing) return { key: 'SECTIONS', group: 'SECTIONS' };
  if (state.focus !== null) {
    const group = `FOCUS:${state.focus.id}`;
    if (state.focus.discussion === true && controller.discussion !== null) return { key: `DISCUSSION:${state.focus.id}`, group, expanded: true };
    return { key: group, group };
  }
  if (search.open && (search.status === 'RESULTS' || search.status === 'NONE' || search.status === 'UNAVAILABLE')) return { key: 'RESULTS', group: 'RESULTS' };
  if (state.status === 'READY' && state.section.key !== null && !search.open && state.camera !== null) return { key: `NEAR:${state.section.key}`, group: 'NEAR' };
  if (state.status === 'UNAVAILABLE') return { key: 'UNAVAILABLE', group: 'UNAVAILABLE' };
  if (state.status === 'READY' && state.entries.length === 0 && !search.open) return { key: 'EMPTY', group: 'EMPTY' };
  return null;
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

function SearchRow({ controller, state, copy, language, query, setQuery, onShow }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly copy: PublicFieldCopy;
  readonly language: ChromeLanguage; readonly query: string; readonly setQuery: (value: string) => void;
  /** Slice D: a submitted search shows its answer in the sheet, even when the reader had closed it. */
  readonly onShow: () => void;
}) {
  const palette = usePalette();
  const { search } = state;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, paddingHorizontal: 12 }}>
      {/* A closed search shows no query: closing it — by its own control or by Back — leaves nothing typed behind. */}
      <TextInput testID="qandeel-public-search" value={search.open ? query : ''} onChangeText={setQuery}
        onFocus={() => { if (!search.open) setQuery(''); controller.openSearch(); }}
        onSubmitEditing={() => { controller.search(query); onShow(); }} returnKeyType="search" maxLength={PUBLIC_SEARCH_QUERY_MAX}
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
function SectionControl({ controller, state, language, onShow }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly language: ChromeLanguage; readonly onShow: () => void;
}) {
  const palette = usePalette();
  if (state.search.open) return null;
  const words = publicComposeCopy(language);
  const shown = state.section.key === null ? words.allSections : words.section(state.section.key);
  return (
    <View style={{ alignItems: 'flex-start', paddingHorizontal: 12 }}>
      <Control palette={palette} language={language} accessibilityLabel={fillCompose(words.sectionShown, shown)} testID="qandeel-public-section-control"
        accessibilityState={{ expanded: state.section.choosing, disabled: state.status !== 'READY' }} onPress={() => { Keyboard.dismiss(); controller.openSections(); onShow(); }}
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
 * The Detail Sheet's content (Slice D; before, the chrome band's): one thing the field says at a time. The focused Experience's panel; else the open search's
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
      onDiscussion={controller.discussion !== null ? () => controller.openDiscussion() : null}
      readPage={controller.contentPage} />;
  } else if (resultsShown) {
    content = (
      <View testID="qandeel-public-search-results" style={{ paddingVertical: 4 }}>
        {search.status === 'RESULTS' ? search.results.map((entry) => (
          <Pressable key={entry.id} testID={`qandeel-public-search-result-${entry.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(entry)}
            accessibilityLanguage={language} onPress={() => { Keyboard.dismiss(); controller.focus(entry.id); }}
            style={({ pressed }) => row(palette, pressed, 16)}>
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
  // Slice D: one surface — the sheet is the panel; this file's own content is no card of its own. The discussion keeps its own
  // surface: PublicDiscussion.tsx is frozen by §19.13, so the card it draws for itself stays until the PO authorises otherwise.
  return <View style={{ paddingHorizontal: 4, paddingTop: 2, paddingBottom: bottomInset + 8 }}>{content}</View>;
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
    <View testID="qandeel-public-sections" style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={() => controller.closeSections()} testID="qandeel-public-sections-back">
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.back}</Text>
        </Control>
        <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingHorizontal: 8, writingDirection: writing }}>{words.sectionsHeading}</Text>
      </View>
      {/* The sheet scrolls what it holds (EXPANDED); the list adds no geometry of its own and is never cut short. */}
      <View accessibilityRole="radiogroup">
        {options.map((option) => {
          const chosen = option.key === state.section.key;
          return (
            <Pressable key={option.key ?? 'all'} testID={`qandeel-public-section-${option.key ?? 'all'}`} accessibilityRole="radio" accessibilityLabel={option.label}
              accessibilityLanguage={language} accessibilityState={{ checked: chosen }} onPress={() => controller.chooseSection(option.key)}
              style={({ pressed }) => row(palette, pressed, 20)}>
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
    <View testID="qandeel-public-section-near" style={{ paddingVertical: 4 }}>
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingHorizontal: 16, paddingTop: 8, writingDirection: writing }}>
        {near.length > 0 ? words.sectionNear : words.sectionNoneHere}
      </Text>
      {near.map((entry) => (
        <Pressable key={entry.id} testID={`qandeel-public-section-near-${entry.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(entry)}
          accessibilityLanguage={language} onPress={() => controller.focus(entry.id)} style={({ pressed }) => row(palette, pressed, 16)}>
          <Text numberOfLines={1} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{publicEntryLabel(entry)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Panel({ copy, palette, language, panel, onBack, onFocus, onDiscussion, readPage }: {
  readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly panel: PublicFieldPanelState; readonly onBack: () => void; readonly onFocus: (id: string) => void;
  readonly onDiscussion: (() => void) | null;
  readonly readPage: PublicFieldController['contentPage'] | null;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement' | 'action', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <View testID="qandeel-public-panel" accessibilityLanguage={language} style={{ paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-public-panel-back">
          <Text style={text('action', palette.restInk)}>{copy.back}</Text>
        </Control>
      </View>
      <View style={{ paddingHorizontal: 20, rowGap: 10 }}>
        {panel.status === 'SERVED' ? (
          <ServedPanel experience={panel.experience} copy={copy} palette={palette} language={language} onFocus={onFocus} onDiscussion={onDiscussion}
            readPage={readPage} />
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

function ServedPanel({ experience, copy, palette, language, onFocus, onDiscussion, readPage }: {
  readonly experience: PublicFieldExperience; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette;
  readonly language: ChromeLanguage; readonly onFocus: (id: string) => void; readonly onDiscussion: (() => void) | null;
  readonly readPage: PublicFieldController['contentPage'] | null;
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
      {/* S8A-05 CP2: a topic made from a conversation (or longer than one page) is read page by page, with its speakers. */}
      <PublicTopicContent key={experience.entry.id} experience={experience} copy={copy} palette={palette} language={language} readPage={readPage} />
      {experience.nearby.length > 0 ? (
        <View style={{ rowGap: 2 }}>
          <Text style={text('metadata', palette.tertiary)}>{copy.nearHeading}</Text>
          {experience.nearby.map((near) => (
            <Pressable key={near.id} testID={`qandeel-public-nearby-${near.id}`} accessibilityRole="button" accessibilityLabel={publicEntryLabel(near)}
              accessibilityLanguage={language} onPress={() => onFocus(near.id)} style={({ pressed }) => row(palette, pressed, 0)}>
              <Text numberOfLines={1} style={text('body', palette.secondary)}>{publicEntryLabel(near)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * Slice D — a full-width row of a list in the sheet: a 44-point target that answers the press with the canonical pressed
 * presence (the same as `Control`), its background highlighting rather than the row scaling.
 */
function row(palette: ConversationPalette, pressed: boolean, paddingHorizontal: number) {
  return { minHeight: 44, justifyContent: 'center' as const, paddingHorizontal, borderRadius: 12, backgroundColor: pressed ? withAlpha(palette.pressedInk, palette.pressedPresence) : undefined };
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
