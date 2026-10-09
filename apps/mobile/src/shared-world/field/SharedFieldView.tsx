/**
 * SHARED-VIS-01 — the Shared World's field in the world frame of the ONE Living Analysis surface.
 *
 * The world view is the surface's own (`useWorldView` / `WorldViewSurface`: the same presentation camera, corridor, drag,
 * semantic step, frame, gesture plane and Reduced Motion the Personal Map and the Public field are drawn in), and the paint
 * is the one generic world renderer (`WorldCanvas`) in the accepted LA-VIS-01 material. What this file brings is only
 * what the Shared field IS:
 *
 *   its owner and camera   — the Shared field controller of ONE open World (`./shared-field-controller`);
 *   its projection         — the World's served places as world nodes (`./shared-field-projection`), in the world's
 *                            neutral place shape (the semantic field's mark, `PublicExperienceMark`, reused);
 *   its acts               — a drag is one pan, a step is one rung of the FAR / MID / NEAR ladder, a tap at FAR discloses
 *                            that part of the World at MID and at MID / NEAR focuses the place under the finger;
 *   its overlay            — the one-line meanings at MID and the accessible targets, laid over the world inside the world
 *                            frame (the semantic field's own label layout, reused; no word is painted into the world);
 *   its accessible name    — the field's name, with the surface's own semantic step as its two actions.
 *
 * Nothing joins two places, nothing draws a member or QANDEEL (D6), nothing animates an arrival. Nothing here animates,
 * recognises a gesture or composes a screen.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typeStyle, usePalette } from '../../conversation';
import type { SemanticZoomDirection, ViewportEnvelope } from '../../map/camera';
import { WorldCanvas, WorldViewSurface, useWorldView } from '../../map/renderer';
import type { ChromeLanguage } from '../../orientation-chrome';
import { PublicExperienceMark } from '../../public-world/field/PublicExperienceMark';
import { layoutFieldLabels, type FieldLabel } from '../../public-world/field/PublicFieldView';
import type { SharedFieldCopy } from './field-copy';
import type { SharedFieldCamera } from './shared-field-camera';
import type { SharedFieldController, SharedFieldOutcome, SharedFieldState } from './shared-field-controller';
import { placeSharedField, type SharedWorldNode } from './shared-field-projection';

export const SHARED_FIELD_SURFACE_TEST_ID = 'qandeel-shared-field-surface';
export const SHARED_FIELD_PLANE_TEST_ID = 'qandeel-shared-field-plane';
export const SHARED_FIELD_WORLD_TEST_ID = 'qandeel-shared-field-world';
/** The accessible target of one place: the Map's own Home hit radius (13 points), so what is painted is what is pressed. */
const TARGET = 26;

export interface SharedFieldViewProps {
  readonly controller: SharedFieldController;
  readonly state: SharedFieldState;
  /** The envelope the surface's world frame measured, with its insets. */
  readonly envelope: ViewportEnvelope;
  readonly copy: SharedFieldCopy;
  readonly language: ChromeLanguage;
}

export function SharedFieldView({ controller, state, envelope, copy, language }: SharedFieldViewProps) {
  const palette = usePalette();
  useEffect(() => {
    controller.setEnvelope(envelope);
  }, [controller, envelope]);

  const camera = state.camera;
  const focusId = state.focus?.id ?? null;
  const placed = useMemo(
    () => (camera === null ? null : placeSharedField({ camera, envelope, entries: state.entries, focusId })),
    [camera, envelope, focusId, state.entries],
  );
  const pan = useCallback((translationX: number, translationY: number) => controller.pan(translationX, translationY), [controller]);
  const step = useCallback((direction: SemanticZoomDirection) => controller.step(direction), [controller]);
  // A place coming onto the glass because the glass moved is navigation, never meaning becoming known: no arrival plays.
  const noCause = useCallback(() => null, []);
  const view = useWorldView<SharedFieldCamera, SharedWorldNode, SharedFieldOutcome>({
    // The owner is the World's own field: a different World is a different presentation, never a continued one.
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

  const labelled = camera === null ? [] : presented.filter((node) => node.selected || (camera.depth === 'MID' && node.presence === 'PLACE'));
  const labels = worldMotion.atRest ? layoutFieldLabels(labelled, presented, envelope, language) : new Map<string, FieldLabel>();
  const targets = worldMotion.atRest ? presented.filter((node) => node.presence !== 'FIELD') : [];
  const contrast = view.world?.contrast ?? 'standard';

  return (
    <WorldViewSurface
      testID={SHARED_FIELD_SURFACE_TEST_ID}
      planeTestID={SHARED_FIELD_PLANE_TEST_ID}
      composed={camera !== null && placed !== null}
      gesture={view.gesture}
      onTap={onTap}
      canvas={
        view.world === undefined ? null : (
        <>
          <View testID={SHARED_FIELD_WORLD_TEST_ID} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <WorldCanvas<SharedWorldNode>
              testID="qandeel-shared-field-canvas"
              envelope={envelope}
              motion={worldMotion.motion}
              presented={presented}
              newlyDisclosed={view.newlyDisclosed}
              arrivals={worldMotion.arrivals}
              cameraCommit={view.cameraCommit}
              world={view.world}
              // Every served place is a place: the world makes its colour around each one, identical for all.
              isPlace={() => true}
              // LA-VIS-01: the place's own served address, read only to colour the world around it (presentation).
              worldAddressOf={(node) => node.entry.address}
              // A Shared place is hosted by nothing: nothing travels from anywhere.
              hostOf={() => undefined}
              renderObject={(node, { S, response }) => (
                <PublicExperienceMark x={node.x} y={node.y} presence={node.presence} selected={node.selected} S={S} response={response} contrast={contrast} />
              )}
            />
          </View>
          {targets.map((node) => (
            <Pressable
              key={node.key}
              testID={`qandeel-shared-mark-${node.entry.id}`}
              onPress={() => controller.focus(node.entry.id)}
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
                testID={`qandeel-shared-label-${node.entry.id}`}
                pointerEvents="none"
                numberOfLines={label.lines}
                accessible={false}
                importantForAccessibility="no"
                style={{
                  ...typeStyle('metadata'),
                  position: 'absolute',
                  top: label.top,
                  ...(label.side === 'RIGHT' ? { left: label.offset } : { right: label.offset }),
                  // Two lines need a definite width: under a maxWidth alone, Android measures the one-line height and
                  // clips the second line (seen on the SHARED-VIS-01 device pass).
                  ...(label.lines === 2 ? { width: label.width } : { maxWidth: label.width }),
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
