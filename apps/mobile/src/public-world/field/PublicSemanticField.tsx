/**
 * S5-03B — «العالم العام» / Public World as a World: the semantic field, its search and its contextual panel.
 *
 * The field is the hero. Each Experience the server serves is drawn at its stable place; nearness on the glass is
 * nearness of meaning and nothing else. Semantic Zoom changes disclosure over the SAME field — never a different screen:
 *
 *   FAR   the World as a field of meaning: places as quiet mass, no labels, not one object leading the reading; a tap
 *         discloses that part of the field at MID;
 *   MID   each Experience is a legible spatial object with its meaning in one line, and can be focused;
 *   NEAR  one Experience has focus; others that share its semantic region keep a quiet presence, the rest recede; the
 *         compact bottom panel discloses its public detail and a very small nearby context.
 *
 * The field is painted in the frozen Living Analysis World language (`./PublicFieldWorld`: the Stage-2 ground, atmosphere,
 * tone and veil, the field's mass and each Public Experience's own presence); this component is its accessible layer —
 * what a reader presses and hears — and paints no world of its own.
 *
 * Search sits at the top and stays inside the same World: results are places in the field, highlighted there, and a
 * result guides the camera to its place. Nothing here is a feed, a card wall, a category browser or a popularity map:
 * no rank, no view count, no relation line of any kind (explicit relations are S5-03C's), and an empty World is shown as
 * empty, with nothing standing in for it.
 *
 * Nothing animates: a camera change is one state change, so reduced motion and full motion are the same field. Every
 * gesture has a non-drag route (closer, farther, the whole World, search, a focusable Experience). Back is local
 * (see the controller); at the World's root nothing is registered.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Control, typeStyle, type ConversationPalette } from '../../conversation';
import { SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR } from '../../map/camera/zoom';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import type { PublicFieldEntry, PublicFieldExperience } from '../../runtime-entry';
import { fillPublicFieldCopy, publicFieldCopy, type PublicFieldCopy } from './field-copy';
import { projectToField, type PublicFieldSize } from './public-field-camera';
import { PublicFieldWorld, fieldMassRadius, type PublicFieldWorldPlace, type PublicPresenceKind } from './PublicFieldWorld';
import { PUBLIC_SEARCH_QUERY_MAX, type PublicFieldController } from './public-field-controller';

export const PUBLIC_FIELD_TEST_ID = 'qandeel-public-field';
/** A pinch asks for a step only once it travels at least the proportion a step is worth (the Map's own rule). */
const PINCH_STEP = 1 + Number(SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR) / Number(SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR);
const MARGIN = 24;
/** The accessible target of one place: the Map's own Home hit radius (13 points), so what is painted is what is pressed. */
const TARGET = 26;
const LABEL_WIDTH = 148;
const SEARCH_ROW = 56;
const PANEL_MAX = 0.46;

export interface PublicSemanticFieldProps {
  readonly controller: PublicFieldController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
}

export function PublicSemanticField({ controller, language, palette, bottomInset }: PublicSemanticFieldProps) {
  const copy = publicFieldCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [size, setSize] = useState<PublicFieldSize | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');

  // Entering the field asks the server again; a previous visit is never kept (nothing is inherited, from anywhere).
  useEffect(() => { controller.enter(); }, [controller]);

  // Local Back: the panel (focus), then the search. At the World's root nothing is registered.
  const local = state.focus !== null || state.search.open;
  useEffect(() => {
    if (!local) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => controller.back());
    return () => subscription.remove();
  }, [controller, local]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
    controller.setSize(width, height);
  };

  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Pan().runOnJS(true).minDistance(8)
      .onUpdate((event) => setDrag({ x: event.translationX, y: event.translationY }))
      .onEnd((event, success) => { setDrag({ x: 0, y: 0 }); if (success) controller.pan(event.translationX, event.translationY); })
      .onFinalize(() => setDrag({ x: 0, y: 0 })),
    Gesture.Pinch().runOnJS(true).onEnd((event, success) => {
      if (!success) return;
      if (event.scale >= PINCH_STEP) controller.closer();
      else if (event.scale <= 1 / PINCH_STEP) controller.farther();
    }),
  ), [controller]);

  const camera = state.camera;
  const focusId = state.focus?.id ?? null;
  const focusedRegion = state.focus ? state.entries.find((entry) => entry.id === focusId)?.region ?? null : null;
  const highlighted = new Set(state.search.open ? state.search.results.map((entry) => entry.id) : []);
  const drawn = useMemo(() => {
    const byId = new Map<string, PublicFieldEntry>();
    for (const entry of [...state.entries, ...state.search.results]) byId.set(entry.id, entry);
    return [...byId.values()];
  }, [state.entries, state.search.results]);

  // What is on the glass, and how each served place is present there. Disclosure alone decides it: FAR is the field's
  // mass, MID a place each, NEAR one focused place with its semantic neighbourhood; a search result is a place at every rung.
  const onGlass = (at: { x: number; y: number }, reach: number) =>
    size !== null && at.x >= -reach && at.y >= -reach && at.x <= size.width + reach && at.y <= size.height + reach;
  const presenceOf = (entry: PublicFieldEntry): PublicPresenceKind => {
    if (highlighted.has(entry.id) || entry.id === focusId) return 'PLACE';
    if (camera!.depth === 'FAR') return 'FIELD';
    if (camera!.depth === 'MID') return 'PLACE';
    return focusedRegion !== null && entry.region === focusedRegion ? 'NEIGHBOURHOOD' : 'RECEDED';
  };
  const projected = camera && size ? drawn.flatMap((entry) => {
    const at = projectToField(camera, size, entry.address);
    return at ? [{ entry, at }] : [];
  }) : [];
  const reach = camera && size ? fieldMassRadius(camera.depth, size) : 0;
  const mass = projected.filter(({ at }) => onGlass(at, reach)).map(({ at }) => at);
  const marks = projected.filter(({ at }) => onGlass(at, MARGIN)).map(({ entry, at }) => ({ entry, at, presence: presenceOf(entry) }));
  const places: PublicFieldWorldPlace[] = marks.map(({ entry, at, presence }) => ({ id: entry.id, at, presence, selected: entry.id === focusId }));

  return (
    <View testID={PUBLIC_FIELD_TEST_ID} style={{ flex: 1 }} onLayout={onLayout}>
      {camera && size ? <PublicFieldWorld size={size} camera={camera} mass={mass} places={places} drag={drag} /> : null}
      <GestureDetector gesture={gesture}>
        <View testID="qandeel-public-field-plane" accessible={camera?.depth === 'FAR'} accessibilityLabel={copy.fieldLabel}
          accessibilityLanguage={language} style={{ flex: 1, overflow: 'hidden' }}
          onStartShouldSetResponder={() => camera?.depth === 'FAR'}
          onResponderRelease={(event) => controller.tapField(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
          <View style={{ flex: 1, transform: [{ translateX: drag.x }, { translateY: drag.y }] }} pointerEvents="box-none">
            {marks.filter(({ presence }) => presence !== 'FIELD').map(({ entry, at, presence }) => (
              <FieldPlace key={entry.id} entry={entry} x={at.x} y={at.y} presence={presence} palette={palette} language={language}
                focused={entry.id === focusId} labelled={camera!.depth === 'MID' || entry.id === focusId}
                onFocus={() => controller.focus(entry.id)} />
            ))}
          </View>
        </View>
      </GestureDetector>

      {state.status === 'READY' && state.entries.length === 0 && !state.search.open ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: SEARCH_ROW, start: 24, end: 24, bottom: 0, justifyContent: 'center' }}>
          <Text testID="qandeel-public-field-empty" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', writingDirection: writing }}>
            {copy.empty}
          </Text>
        </View>
      ) : null}
      {state.status === 'UNAVAILABLE' ? (
        <View style={{ position: 'absolute', top: SEARCH_ROW, start: 24, end: 24, bottom: 0, justifyContent: 'center', alignItems: 'center', rowGap: 12 }}>
          <Text testID="qandeel-public-field-unavailable" style={{ ...typeStyle('body'), color: palette.secondary, textAlign: 'center', writingDirection: writing }}>
            {copy.fieldUnavailable}
          </Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.enter()} testID="qandeel-public-field-retry">
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.retry}</Text>
          </Control>
        </View>
      ) : null}

      <SearchBar controller={controller} copy={copy} palette={palette} language={language} query={query} setQuery={setQuery} />

      {state.status === 'READY' && state.focus === null && state.entries.length > 0 ? (
        <View style={{ position: 'absolute', end: 12, bottom: bottomInset + 16, rowGap: 8 }}>
          <Control palette={palette} language={language} accessibilityLabel={copy.closer} onPress={() => controller.closer()} testID="qandeel-public-field-closer">
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{'+'}</Text>
          </Control>
          <Control palette={palette} language={language} accessibilityLabel={copy.farther} onPress={() => controller.farther()} testID="qandeel-public-field-farther">
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{'−'}</Text>
          </Control>
          <Control palette={palette} language={language} accessibilityLabel={copy.wholeWorld} onPress={() => controller.wholeWorld()} testID="qandeel-public-field-whole">
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{'○'}</Text>
          </Control>
        </View>
      ) : null}

      {state.focus !== null ? (
        <Panel copy={copy} palette={palette} language={language} bottomInset={bottomInset} height={size?.height ?? 0}
          panel={state.focus.panel} onBack={() => controller.back()} onFocus={(id) => controller.focus(id)} />
      ) : null}
    </View>
  );
}

/**
 * The accessible layer of one place at MID / NEAR: what a reader presses and hears, exactly over the place the world paints
 * (`PublicFieldWorld`). It paints no body of its own; its one visible part is the meaning in one line where disclosure
 * says so. At FAR there is none: the field itself is the target, and no single Experience leads the reading.
 */
function FieldPlace({ entry, x, y, presence, palette, language, focused, labelled, onFocus }: {
  readonly entry: PublicFieldEntry; readonly x: number; readonly y: number; readonly presence: PublicPresenceKind;
  readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly focused: boolean; readonly labelled: boolean;
  readonly onFocus: () => void;
}) {
  return (
    <Pressable testID={`qandeel-public-mark-${entry.id}`} onPress={onFocus} accessibilityRole="button" accessibilityLabel={entry.meaning}
      accessibilityLanguage={language} accessibilityState={{ selected: focused }} hitSlop={4}
      style={{ position: 'absolute', left: x - TARGET / 2, top: y - TARGET / 2, minHeight: TARGET, flexDirection: 'row', alignItems: 'center',
        opacity: presence === 'RECEDED' ? 0.6 : 1 }}>
      <View style={{ width: TARGET, height: TARGET }} />
      {labelled ? (
        <Text numberOfLines={1} style={{ ...typeStyle('metadata'), color: focused ? palette.primary : palette.secondary, maxWidth: LABEL_WIDTH }}>
          {entry.meaning}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SearchBar({ controller, copy, palette, language, query, setQuery }: {
  readonly controller: PublicFieldController; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly query: string; readonly setQuery: (value: string) => void;
}) {
  const { search } = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View style={{ position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: 12, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <TextInput testID="qandeel-public-search" value={query} onChangeText={setQuery} onFocus={() => controller.openSearch()}
          onSubmitEditing={() => controller.search(query)} returnKeyType="search" maxLength={PUBLIC_SEARCH_QUERY_MAX}
          accessibilityLabel={copy.searchLabel} placeholder={copy.searchLabel} placeholderTextColor={palette.tertiary} accessibilityLanguage={language}
          selectionColor={palette.primary} cursorColor={palette.primary}
          style={{ ...typeStyle('body'), flex: 1, minHeight: 44, color: palette.primary, backgroundColor: palette.field, borderRadius: 22,
            paddingHorizontal: 16, writingDirection: writing, textAlign: writing === 'rtl' ? 'right' : 'left' }} />
        {search.open ? (
          <Control palette={palette} language={language} accessibilityLabel={copy.cancel} testID="qandeel-public-search-close"
            onPress={() => { setQuery(''); controller.closeSearch(); }}>
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
          </Control>
        ) : null}
      </View>
      {search.open && (search.status === 'RESULTS' || search.status === 'NONE' || search.status === 'UNAVAILABLE') ? (
        <View testID="qandeel-public-search-results" style={{ marginTop: 6, maxHeight: 220, backgroundColor: palette.field, borderRadius: 16 }}>
          {search.status === 'RESULTS' ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              {search.results.map((entry) => (
                <Pressable key={entry.id} testID={`qandeel-public-search-result-${entry.id}`} accessibilityRole="button" accessibilityLabel={entry.meaning}
                  accessibilityLanguage={language} onPress={() => controller.focus(entry.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
                  <Text numberOfLines={1} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{entry.meaning}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, padding: 16, writingDirection: writing }}>
              {search.status === 'NONE' ? copy.noResults : copy.fieldUnavailable}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Panel({ copy, palette, language, bottomInset, height, panel, onBack, onFocus }: {
  readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly bottomInset: number;
  readonly height: number; readonly panel: { readonly status: 'LOADING' } | { readonly status: 'SERVED'; readonly experience: PublicFieldExperience }
    | { readonly status: 'ABSENT' } | { readonly status: 'UNAVAILABLE' };
  readonly onBack: () => void; readonly onFocus: (id: string) => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'supporting' | 'metadata' | 'statement' | 'action', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  return (
    <View testID="qandeel-public-panel" accessibilityLanguage={language}
      style={{ position: 'absolute', start: 0, end: 0, bottom: 0, maxHeight: height > 0 ? height * PANEL_MAX : undefined,
        backgroundColor: palette.field, borderTopStartRadius: 20, borderTopEndRadius: 20, paddingBottom: bottomInset + 8 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-public-panel-back">
          <Text style={text('action', palette.restInk)}>{copy.back}</Text>
        </Control>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, rowGap: 10 }}>
        {panel.status === 'SERVED' ? (
          <>
            <Text testID="qandeel-public-panel-meaning" accessibilityRole="header" style={text('statement', palette.primary)}>{panel.experience.entry.meaning}</Text>
            {panel.experience.publisher.label !== null ? (
              <Text style={text('metadata', palette.secondary)}>{fillPublicFieldCopy(copy.sharedBy, panel.experience.publisher.label)}</Text>
            ) : null}
            <Themes heading={copy.primaryHeading} themes={panel.experience.primaryThemes} palette={palette} language={language} />
            <Themes heading={copy.secondaryHeading} themes={panel.experience.secondaryThemes} palette={palette} language={language} />
            {panel.experience.content.map((item) => (
              <View key={item.ordinal} style={{ rowGap: 2 }}>
                {item.kind === 'ANALYSIS' ? <Text style={text('metadata', palette.tertiary)}>{copy.analysisItem}</Text> : null}
                <Text style={text('body', palette.primary)}>{item.text}</Text>
              </View>
            ))}
            {panel.experience.nearby.length > 0 ? (
              <View style={{ rowGap: 2 }}>
                <Text style={text('metadata', palette.tertiary)}>{copy.nearHeading}</Text>
                {panel.experience.nearby.map((near) => (
                  <Pressable key={near.id} testID={`qandeel-public-nearby-${near.id}`} accessibilityRole="button" accessibilityLabel={near.meaning}
                    accessibilityLanguage={language} onPress={() => onFocus(near.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={text('body', palette.secondary)}>{near.meaning}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : panel.status === 'LOADING' ? (
          <View accessible accessibilityState={{ busy: true }} style={{ minHeight: 48 }} />
        ) : (
          <Text testID="qandeel-public-panel-absent" accessibilityLiveRegion="polite" style={text('body', palette.secondary)}>
            {panel.status === 'ABSENT' ? copy.experienceUnavailable : copy.fieldUnavailable}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function Themes({ heading, themes, palette, language }: {
  readonly heading: string; readonly themes: ReadonlyArray<string>; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
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
