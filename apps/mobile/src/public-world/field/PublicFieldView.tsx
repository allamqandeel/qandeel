/**
 * S5-03B R2 — the Public field in the world frame of the ONE Living Analysis surface.
 *
 * The world view is the surface's own (`useWorldView` / `WorldViewSurface`, the same presentation camera, corridor,
 * drag, semantic step, frame and gesture plane the Personal Map is drawn in), and the paint is the one generic world
 * renderer (`WorldCanvas`). What this file brings is only what the Public field IS:
 *
 *   its owner and camera   — the Public field controller (`./public-field-controller`), never a Personal store;
 *   its projection         — served Experiences as world nodes (`./public-field-projection`), in the neutral Public
 *                            shape of the world's material (`./PublicExperienceMark`);
 *   its acts               — a drag is one Public pan, a step is one rung of the Public FAR / MID / NEAR ladder, a tap
 *                            at FAR discloses that part of the field at MID and at MID / NEAR focuses the place;
 *   its overlay            — the one-line meanings at MID and the accessible targets, laid over the world inside the
 *                            world frame (no word is painted into the world itself);
 *   its accessible name    — the field's name, with the surface's own semantic step as its two actions.
 *
 * Nothing here animates, recognises a gesture or composes a screen.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { typeStyle, usePalette } from '../../conversation';
import type { SemanticZoomDirection, ViewportEnvelope } from '../../map/camera';
import { WorldCanvas, WorldViewSurface, useWorldView } from '../../map/renderer';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { PublicFieldCopy } from './field-copy';
import { PublicExperienceMark } from './PublicExperienceMark';
import type { PublicFieldCamera } from './public-field-camera';
import type { PublicFieldController, PublicFieldOutcome, PublicFieldState } from './public-field-controller';
import { placePublicField, type PublicWorldNode } from './public-field-projection';

export const PUBLIC_FIELD_SURFACE_TEST_ID = 'qandeel-public-field-surface';
export const PUBLIC_FIELD_PLANE_TEST_ID = 'qandeel-public-field-plane';
export const PUBLIC_FIELD_WORLD_TEST_ID = 'qandeel-public-field-world';
/** The accessible target of one place: the Map's own Home hit radius (13 points), so what is painted is what is pressed. */
const TARGET = 26;

export interface PublicFieldViewProps {
  readonly controller: PublicFieldController;
  readonly state: PublicFieldState;
  /** The envelope the surface's world frame measured, with its insets. */
  readonly envelope: ViewportEnvelope;
  readonly copy: PublicFieldCopy;
  readonly language: ChromeLanguage;
}

export function PublicFieldView({ controller, state, envelope, copy, language }: PublicFieldViewProps) {
  const palette = usePalette();
  // The field's glass is the frame the surface measured: what the controller reads from the server is exactly what the
  // world view shows.
  useEffect(() => {
    controller.setEnvelope(envelope);
  }, [controller, envelope]);

  const camera = state.camera;
  const focusId = state.focus?.id ?? null;
  const placed = useMemo(
    () => (camera === null ? null : placePublicField({ camera, envelope, entries: state.entries, results: state.search.open ? state.search.results : [], focusId })),
    [camera, envelope, focusId, state.entries, state.search.open, state.search.results],
  );
  // The Public field's two camera acts, in ITS controller: one completed drag is one Public pan, one step is one rung.
  const pan = useCallback((translationX: number, translationY: number) => controller.pan(translationX, translationY), [controller]);
  const step = useCallback((direction: SemanticZoomDirection) => controller.step(direction), [controller]);
  // A served Experience coming onto the glass because the glass moved is navigation, never meaning becoming known: the
  // Public field keeps no disclosure record, so nothing in it ever plays an arrival.
  const noCause = useCallback(() => null, []);
  const view = useWorldView<PublicFieldCamera, PublicWorldNode, PublicFieldOutcome>({
    owner: controller,
    envelope,
    camera,
    placed,
    membership: null,
    cause: noCause,
    enabled: camera !== null && state.status === 'READY',
    inspection: null,
    pan,
    step,
  });
  const { worldMotion, presented, nodeAt } = view;

  // A tap reads the glass through the SAME residual the frame is painted with: FAR discloses that part of the field at
  // MID; at MID / NEAR it focuses the place under the finger.
  const onTap = useCallback(
    (x: number, y: number) => {
      if (camera === null) return;
      if (camera.depth === 'FAR') {
        const at = worldMotion.motion.canonicalPointAt({ x, y });
        controller.tapField(at.x, at.y);
        return;
      }
      const node = nodeAt(x, y);
      if (node !== null) controller.focus(node.entry.id);
    },
    [camera, controller, nodeAt, worldMotion.motion],
  );

  // The meaning in one line beside each place at MID (and beside the focused place), laid out so no label covers another
  // or another place, and none is cut by the glass or by what the surface keeps over it. It waits for the world to come
  // to rest, so a word is never left behind a moving place.
  const labelled = camera === null ? [] : presented.filter((node) => node.selected || (camera.depth === 'MID' && node.presence === 'PLACE'));
  const labels = worldMotion.atRest ? layoutFieldLabels(labelled, presented, envelope, language) : new Map<string, FieldLabel>();
  const targets = worldMotion.atRest ? presented.filter((node) => node.presence !== 'FIELD') : [];
  const contrast = view.world?.contrast ?? 'standard';

  return (
    <WorldViewSurface
      testID={PUBLIC_FIELD_SURFACE_TEST_ID}
      planeTestID={PUBLIC_FIELD_PLANE_TEST_ID}
      composed={camera !== null && placed !== null}
      gesture={view.gesture}
      onTap={onTap}
      canvas={
        view.world === undefined ? null : (
        <>
          <View testID={PUBLIC_FIELD_WORLD_TEST_ID} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <WorldCanvas<PublicWorldNode>
              testID="qandeel-public-field-canvas"
              envelope={envelope}
              motion={worldMotion.motion}
              presented={presented}
              newlyDisclosed={view.newlyDisclosed}
              arrivals={worldMotion.arrivals}
              cameraCommit={view.cameraCommit}
              world={view.world}
              // Every served Experience is a place: the world makes its colour around each one, identical for all.
              isPlace={() => true}
              // A Public Experience is hosted by nothing: nothing travels from anywhere, and nothing joins two of them.
              hostOf={() => undefined}
              renderObject={(node, { S, response }) => (
                <PublicExperienceMark x={node.x} y={node.y} presence={node.presence} selected={node.selected} S={S} response={response} contrast={contrast} />
              )}
            />
          </View>
          {targets.map((node) => (
            <Pressable
              key={node.key}
              testID={`qandeel-public-mark-${node.entry.id}`}
              onPress={() => {
                Keyboard.dismiss();
                controller.focus(node.entry.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={node.entry.meaning}
              accessibilityLanguage={language}
              accessibilityState={{ selected: node.selected }}
              hitSlop={4}
              style={{ position: 'absolute', left: node.x - TARGET / 2, top: node.y - TARGET / 2, width: TARGET, height: TARGET }}
            />
          ))}
          {labelled.map((node) => {
            const label = labels.get(node.key);
            if (label === undefined) return null;
            return (
              <Text
                key={`label:${node.key}`}
                testID={`qandeel-public-label-${node.entry.id}`}
                pointerEvents="none"
                numberOfLines={1}
                accessible={false}
                importantForAccessibility="no"
                style={{
                  ...typeStyle('metadata'),
                  position: 'absolute',
                  top: label.top,
                  ...(label.side === 'RIGHT' ? { left: label.offset } : { right: label.offset }),
                  maxWidth: label.width,
                  color: node.selected ? palette.primary : palette.secondary,
                  writingDirection: language === 'ar' ? 'rtl' : 'ltr',
                  textAlign: label.side === 'RIGHT' ? 'left' : 'right',
                }}
              >
                {node.entry.meaning}
              </Text>
            );
          })}
        </>
        )
      }
      semanticStep={{ label: copy.fieldLabel, language, moreDetail: copy.moreDetail, lessDetail: copy.lessDetail, onStep: view.semanticStep }}
    />
  );
}

/** Where one place's one-line meaning sits: beside the place, on one side, inside the glass. */
export interface FieldLabel {
  readonly side: 'LEFT' | 'RIGHT';
  /** The distance from the glass side it is anchored to (left for RIGHT, right for LEFT), in points. */
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
 * Lays out the MID meanings as an overlay in the world frame. Deterministic and meaning-free: the focused place first,
 * then from the top of the glass down — never by anything about an Experience. Each label tries the side its reading
 * direction puts text on, then the other; a label that would cover another label or another place, or be cut by the
 * glass or by the envelope's insets (what the surface keeps over the world: the top band), is not drawn (the place is
 * still there, still focusable and still announced by its meaning); only the focused place's own meaning may lie over a
 * neighbour.
 */
export function layoutFieldLabels(
  labelled: readonly PublicWorldNode[],
  places: readonly PublicWorldNode[],
  envelope: ViewportEnvelope,
  language: ChromeLanguage,
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
    if (top < envelope.insetTop || bottom > envelope.height - envelope.insetBottom) continue;
    for (const side of sides) {
      const left = side === 'RIGHT' ? node.x + LABEL_GAP : node.x - LABEL_GAP - width;
      const right = left + width;
      if (left < envelope.insetLeft + LABEL_MARGIN || right > envelope.width - envelope.insetRight - LABEL_MARGIN) continue;
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
