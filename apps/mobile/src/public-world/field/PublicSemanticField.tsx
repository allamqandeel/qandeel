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
 * S5-03B Phase 2 — the field IS the Living Analysis World. It is painted by the one generic world renderer the Personal
 * Map paints through (`WorldCanvas`), under the same presentation camera, travel and drag corridor (`useWorldMotion`,
 * `useWorldFrame`), with the same material, at the Map's own metric. What is Public is only what the field says: the
 * projection of served Experiences (`./public-field-projection`), the controller, the FAR / MID / NEAR policy, search,
 * the contextual panel, and the screen-space chrome over the world — the one-line meanings at MID and the accessible
 * targets. No word is painted into the world itself (D3).
 *
 * Search sits at the top and stays inside the same World: results are places in the field, highlighted there, and a
 * result guides the camera to its place; once a result is chosen the list folds away so it never covers the panel.
 * Nothing here is a feed, a card wall, a category browser or a popularity map: no order of importance, no view count,
 * no line between Experiences (explicit links are S5-03C's), and an empty World is shown as empty, with nothing
 * standing in for it.
 *
 * Every gesture has a non-drag route (closer, farther, the whole World, search, a focusable Experience). Back is local
 * (see the controller); at the World's root nothing is registered.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Control, typeStyle, useIncreasedContrast, type ConversationPalette } from '../../conversation';
import { SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR, SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR, viewportEnvelope, type ViewportEnvelope } from '../../map/camera';
import { WorldCanvas, useWorldFrame, useWorldMotion } from '../../map/renderer';
import { worldPresentation } from '../../map/visual';
import { handoffToProduct } from '../../motion';
import type { ChromeLanguage } from '../../orientation-chrome';
import { semanticListSeparator } from '../../public-authoring/semantic-copy';
import type { PublicFieldExperience } from '../../runtime-entry';
import { fillPublicFieldCopy, publicFieldCopy, type PublicFieldCopy } from './field-copy';
import { PublicExperienceMark } from './PublicExperienceMark';
import type { PublicFieldCamera } from './public-field-camera';
import { PUBLIC_SEARCH_QUERY_MAX, type PublicFieldController, type PublicFieldState } from './public-field-controller';
import { placePublicField, type PublicWorldNode } from './public-field-projection';

export const PUBLIC_FIELD_TEST_ID = 'qandeel-public-field';
export const PUBLIC_FIELD_WORLD_TEST_ID = 'qandeel-public-field-world';
/** A pinch asks for a step only once it travels at least the proportion a step is worth (the Map's own rule). */
const PINCH_STEP = 1 + Number(SEMANTIC_ZOOM_REINFORCEMENT_NUMERATOR) / Number(SEMANTIC_ZOOM_REINFORCEMENT_DENOMINATOR);
/** The accessible target of one place: the Map's own Home hit radius (13 points), so what is painted is what is pressed. */
const TARGET = 26;
const SEARCH_ROW = 56;
const RESULTS_MAX = 220;
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
  const [envelope, setEnvelope] = useState<ViewportEnvelope | null>(null);
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
    setEnvelope(viewportEnvelope(width, height));
    controller.setSize(width, height);
  };

  // The list folds away once a place is chosen, so it never covers the focused panel; Back returns to it.
  const resultsShown = state.search.open && state.focus === null
    && (state.search.status === 'RESULTS' || state.search.status === 'NONE' || state.search.status === 'UNAVAILABLE');
  const height = envelope?.height ?? 0;
  const clear = {
    top: SEARCH_ROW + (resultsShown ? RESULTS_MAX + 6 : 0),
    bottom: state.focus !== null ? height * PANEL_MAX + bottomInset : bottomInset,
  };

  return (
    <View testID={PUBLIC_FIELD_TEST_ID} style={{ flex: 1 }} onLayout={onLayout}>
      {state.camera && envelope ? (
        <FieldWorld controller={controller} state={state} camera={state.camera} envelope={envelope} copy={copy} palette={palette}
          language={language} clear={clear} />
      ) : null}

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

      <SearchBar controller={controller} state={state} copy={copy} palette={palette} language={language} query={query} setQuery={setQuery}
        resultsShown={resultsShown} />

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
        <Panel copy={copy} palette={palette} language={language} bottomInset={bottomInset} height={height}
          panel={state.focus.panel} onBack={() => controller.back()} onFocus={(id) => controller.focus(id)} />
      ) : null}
    </View>
  );
}

/**
 * The world, and the Public chrome laid over it. The world is the generic Living Analysis World surface: one
 * presentation camera, its corridor and its rebase (`useWorldMotion` / `useWorldFrame`), painted by `WorldCanvas`. The
 * field is its own authority: the controller is the owner a residual and a drag belong to.
 */
function FieldWorld({ controller, state, camera, envelope, copy, palette, language, clear }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly camera: PublicFieldCamera;
  readonly envelope: ViewportEnvelope; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly clear: { readonly top: number; readonly bottom: number };
}) {
  const worldMotion = useWorldMotion<PublicFieldCamera>(envelope);
  const { motion } = worldMotion;
  const increasedContrast = useIncreasedContrast();
  const contrast = increasedContrast ? 'increased' : 'standard';
  // The Map's own expression facts of this camera — its distance, its strata anchoring — at the Map's own metric.
  const world = useMemo(
    () => worldPresentation(camera, { reducedMotion: motion.reducedMotion, contrast, inspection: null }),
    [camera, contrast, motion.reducedMotion],
  );
  const focusId = state.focus?.id ?? null;
  const placed = useMemo(
    () => placePublicField({ camera, envelope, entries: state.entries, results: state.search.open ? state.search.results : [], focusId }),
    [camera, envelope, focusId, state.entries, state.search.open, state.search.results],
  );
  const noCause = useCallback(() => null, []);
  // A served Experience coming onto the glass because the glass moved is navigation, never meaning becoming known: the
  // Public field keeps no disclosure record, so nothing in it ever plays an arrival.
  const { cameraCommit, presented, newlyDisclosed, nodeAt } = useWorldFrame<PublicFieldCamera, PublicWorldNode>(worldMotion, {
    owner: controller,
    camera,
    envelope,
    placed,
    membership: null,
    cause: noCause,
  });

  // ONE completed drag → ONE Public pan, from the finger's own total translation, exactly as the Map's drag route: the
  // plane follows the hand on the UI runtime, and a pan that moved nothing brings the presentation home.
  const settle = useCallback((translationX: number, translationY: number) => {
    const before = controller.getState().camera;
    controller.pan(translationX, translationY);
    if (controller.getState().camera === before) motion.resolveToRest();
  }, [controller, motion]);
  const discard = useCallback(() => motion.resolveToRest(), [motion]);
  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Pan().maxPointers(1).minDistance(8)
      .onBegin(() => { motion.grab(); })
      .onChange((event) => { motion.dragBy(event.changeX, event.changeY); })
      .onEnd((event, success) => {
        motion.release();
        if (success) handoffToProduct(settle, event.translationX, event.translationY);
        else handoffToProduct(discard);
      })
      .onFinalize((_event, success) => {
        if (success) return;
        motion.release();
        handoffToProduct(discard);
      }),
    Gesture.Pinch().runOnJS(true).onEnd((event, success) => {
      if (!success) return;
      if (event.scale >= PINCH_STEP) controller.closer();
      else if (event.scale <= 1 / PINCH_STEP) controller.farther();
    }),
  ), [controller, discard, motion, settle]);

  // A tap reads the glass through the SAME residual the frame is painted with: FAR discloses that part of the field at
  // MID; at MID / NEAR it focuses the place under the finger.
  const onTap = (x: number, y: number) => {
    if (camera.depth === 'FAR') {
      const at = motion.canonicalPointAt({ x, y });
      controller.tapField(at.x, at.y);
      return;
    }
    const node = nodeAt(x, y);
    if (node !== null) controller.focus(node.entry.id);
  };

  // The meaning in one line beside each place at MID (and beside the focused place): Public chrome over the world, laid
  // out so no label covers another or another place, and none is cut by the glass, the search or the panel. It waits
  // for the world to come to rest, so a word is never left behind a moving place.
  const labelled = presented.filter((node) => node.selected || (camera.depth === 'MID' && node.presence === 'PLACE'));
  const labels = worldMotion.atRest ? layoutFieldLabels(labelled, presented, envelope, language, clear) : new Map<string, FieldLabel>();
  const targets = worldMotion.atRest ? presented.filter((node) => node.presence !== 'FIELD') : [];

  return (
    <View style={StyleSheet.absoluteFill}>
      <View testID={PUBLIC_FIELD_WORLD_TEST_ID} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WorldCanvas<PublicWorldNode>
          testID="qandeel-public-field-canvas"
          envelope={envelope}
          motion={motion}
          presented={presented}
          newlyDisclosed={newlyDisclosed}
          arrivals={worldMotion.arrivals}
          cameraCommit={cameraCommit}
          world={world}
          // Every served Experience is a place: the world makes its colour around each one, identical for all.
          isPlace={() => true}
          // A Public Experience is hosted by nothing: nothing travels from anywhere, and nothing joins two of them.
          hostOf={() => undefined}
          renderObject={(node, { S, response }) => (
            <PublicExperienceMark x={node.x} y={node.y} presence={node.presence} selected={node.selected} S={S} response={response} contrast={contrast} />
          )}
        />
      </View>
      <GestureDetector gesture={gesture}>
        <View testID="qandeel-public-field-plane" accessible={camera.depth === 'FAR'} accessibilityLabel={copy.fieldLabel}
          accessibilityLanguage={language} style={{ flex: 1, overflow: 'hidden' }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(event) => onTap(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
          {targets.map((node) => (
            <Pressable key={node.key} testID={`qandeel-public-mark-${node.entry.id}`} onPress={() => { Keyboard.dismiss(); controller.focus(node.entry.id); }}
              accessibilityRole="button" accessibilityLabel={node.entry.meaning} accessibilityLanguage={language}
              accessibilityState={{ selected: node.selected }} hitSlop={4}
              style={{ position: 'absolute', left: node.x - TARGET / 2, top: node.y - TARGET / 2, width: TARGET, height: TARGET }} />
          ))}
          {labelled.map((node) => {
            const label = labels.get(node.key);
            if (label === undefined) return null;
            return (
              <Text key={`label:${node.key}`} testID={`qandeel-public-label-${node.entry.id}`} pointerEvents="none" numberOfLines={1}
                accessible={false} importantForAccessibility="no"
                style={{ ...typeStyle('metadata'), position: 'absolute', top: label.top, ...(label.side === 'RIGHT' ? { left: label.offset } : { right: label.offset }),
                  maxWidth: label.width, color: node.selected ? palette.primary : palette.secondary,
                  writingDirection: language === 'ar' ? 'rtl' : 'ltr', textAlign: label.side === 'RIGHT' ? 'left' : 'right' }}>
                {node.entry.meaning}
              </Text>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

/** Where one place's one-line meaning sits: beside the place, on one side, inside the glass. */
export interface FieldLabel {
  readonly side: 'LEFT' | 'RIGHT';
  /** The distance from the glass edge on that side (left for RIGHT, right for LEFT), in points. */
  readonly offset: number;
  readonly top: number;
  readonly width: number;
}

const LABEL_MAX_WIDTH = 148;
/** Clear of the place's own hit radius (13 points), so a label never touches its mark or its SELECTED marker. */
const LABEL_GAP = 17;
const LABEL_MARGIN = 8;
/** The disc around another place a label must not cover: the place's own hit radius. */
const PLACE_CLEARANCE = 13;

/**
 * Lays out the MID meanings as screen-space chrome. Deterministic and meaning-free: the focused place first, then from
 * the top of the glass down — never by anything about an Experience. Each label tries the side its reading direction
 * puts text on, then the other; a label that would cover another label or another place, or be cut by the glass, the
 * search or the panel, is not drawn (the place is still there, still focusable and still announced by its meaning);
 * only the focused place's own meaning may lie over a neighbour.
 */
export function layoutFieldLabels(
  labelled: readonly PublicWorldNode[],
  places: readonly PublicWorldNode[],
  envelope: ViewportEnvelope,
  language: ChromeLanguage,
  clear: { readonly top: number; readonly bottom: number },
): Map<string, FieldLabel> {
  const type = typeStyle('metadata');
  const lineHeight = type.lineHeight;
  const ordered = [...labelled].sort((a, b) => (a.selected === b.selected ? a.y - b.y || a.x - b.x : a.selected ? -1 : 1));
  const taken: { left: number; top: number; right: number; bottom: number }[] = [];
  const out = new Map<string, FieldLabel>();
  const sides: readonly ('LEFT' | 'RIGHT')[] = language === 'ar' ? ['LEFT', 'RIGHT'] : ['RIGHT', 'LEFT'];
  for (const node of ordered) {
    const width = Math.min(LABEL_MAX_WIDTH, Math.ceil(node.entry.meaning.length * type.fontSize * 0.62) + 4);
    const top = node.y - lineHeight / 2;
    const bottom = top + lineHeight;
    if (top < clear.top || bottom > envelope.height - clear.bottom) continue;
    for (const side of sides) {
      const left = side === 'RIGHT' ? node.x + LABEL_GAP : node.x - LABEL_GAP - width;
      const right = left + width;
      if (left < LABEL_MARGIN || right > envelope.width - LABEL_MARGIN) continue;
      const box = { left, top, right, bottom };
      const overlaps = (o: typeof box) => o.left < box.right && box.left < o.right && o.top < box.bottom && box.top < o.bottom;
      if (taken.some(overlaps)) continue;
      // The focused place's meaning is the reading, so it may lie over a neighbour; every other label may not.
      const coversPlace = !node.selected && places.some((other) => other.key !== node.key
        && other.x + PLACE_CLEARANCE > left && other.x - PLACE_CLEARANCE < right && other.y + PLACE_CLEARANCE > top && other.y - PLACE_CLEARANCE < bottom);
      if (coversPlace) continue;
      taken.push(box);
      out.set(node.key, { side, offset: side === 'RIGHT' ? left : envelope.width - right, top, width });
      break;
    }
  }
  return out;
}

function SearchBar({ controller, state, copy, palette, language, query, setQuery, resultsShown }: {
  readonly controller: PublicFieldController; readonly state: PublicFieldState; readonly copy: PublicFieldCopy; readonly palette: ConversationPalette;
  readonly language: ChromeLanguage; readonly query: string; readonly setQuery: (value: string) => void; readonly resultsShown: boolean;
}) {
  const { search } = state;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View style={{ position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: 12, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
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
      {resultsShown ? (
        <View testID="qandeel-public-search-results" style={{ marginTop: 6, maxHeight: RESULTS_MAX, backgroundColor: palette.field, borderRadius: 16 }}>
          {search.status === 'RESULTS' ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              {search.results.map((entry) => (
                <Pressable key={entry.id} testID={`qandeel-public-search-result-${entry.id}`} accessibilityRole="button" accessibilityLabel={entry.meaning}
                  accessibilityLanguage={language} onPress={() => { Keyboard.dismiss(); controller.focus(entry.id); }}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
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
