/**
 * COSMOS-INT-01 Slice D (Contract v1.5 §19) — the COSMOS Detail Sheet: one view above the stage, in the stage.
 *
 * The host mounts it as a sibling AFTER `CosmosWorldView` inside its `stage(glass)` fragment, so the host's top band —
 * mounted above the stage by the ONE surface — stays visible and interactive in every phase (D-11), and the canvas,
 * the world view and the camera are never re-created by a phase change: nothing here is keyed by the phase.
 *
 *   CLOSED   — translated below the glass, `pointerEvents="none"`, hidden from accessibility. The content stays mounted.
 *   PEEK     — the content's top (`sheet-geometry.ts`); the whole sheet drags; the content does not scroll.
 *   EXPANDED — from beneath the top band to the bottom of the glass, less the keyboard; only the handle drags and the
 *              content scrolls; the sheet is the accessibility modal (the host hides the stage, `CosmosSheetStage`).
 *
 * The phase is the host's (`useDetailSheet`) and presentation only. This view moves ONE shared value on the UI runtime;
 * the JS phase is told once, when a drag settles (`scheduleOnRN`), and nothing runs per animation frame. The handle's
 * actions (the three APPROVED accessibility rows, SD-7) check their own availability: an unavailable one does nothing.
 *
 * Surface (PO direction 2026-11-16, premium; the accepted COSMOS V5 card is its source): the night glass of the accepted
 * card, a hairline edge, continuous top corners and a soft lift off the world; while the sheet is about ONE focused item
 * a hairline of COSMOS gold runs along its top — the focused mark's own colour — so the details read as that item's.
 *
 * Motion (the installed expo-animation skill's tables; one purpose each — spatial continuity, state indication):
 *   - a programmatic move (an opening, a collapse by Back or by the handle) settles with no overshoot
 *     (`{ duration: 300, dampingRatio: 1 }`, the sheet duration);
 *   - a released drag hands its velocity to the spring (`{ duration: 300, dampingRatio: 0.8, velocity }`), with the
 *     overshoot clamped at the hard edges (closed, and the top beneath the band) — momentum may only settle into PEEK;
 *   - past the highest stop the sheet resists (rubber band) instead of stopping dead; a grab mid-flight continues from
 *     where the eye last saw it;
 *   - a new subject (another Experience, results → panel) brings its content in with a short ease-out (180 ms);
 *   - Reduce Motion: positions are instant, and an opening fades the surface in (150 ms) — fewer and gentler, not zero.
 * The distance-led snap of §19.7 is kept deliberately over the skill's "a flick is enough": the PO's amendment binds
 * that a brief accidental flick never dismisses.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ViewportEnvelope } from '../../../map/camera';
import type { ChromeLanguage } from '../../../orientation-chrome';
import { cosmosProductCopy } from '../copy';
import type { CosmosWorldOwner } from '../owner-core';
import { SHEET_HANDLE_HEIGHT, dragOffset, keyboardLift, keyboardOverlap, sheetGeometry, sheetOffset, sheetStops, snapPhase, type SheetGeometry, type SheetPhase } from './sheet-geometry';

export const COSMOS_SHEET_TEST_ID = 'cosmos-detail-sheet';
export const COSMOS_SHEET_HANDLE_TEST_ID = 'cosmos-detail-sheet-handle';
export const COSMOS_SHEET_SCROLL_TEST_ID = 'cosmos-detail-sheet-scroll';
export const COSMOS_SHEET_STAGE_TEST_ID = 'cosmos-detail-sheet-stage';
export const COSMOS_SHEET_ACCENT_TEST_ID = 'cosmos-detail-sheet-accent';
/** The two drags, for the gesture test utilities: the handle's (every open phase) and the body's (PEEK only). */
export const COSMOS_SHEET_HANDLE_GESTURE_TEST_ID = 'cosmos-sheet-handle-pan';
export const COSMOS_SHEET_BODY_GESTURE_TEST_ID = 'cosmos-sheet-body-pan';
/** §19.7: a vertical drag activates after 12 pt; a horizontal motion of 16 pt fails it, so horizontal content keeps it. */
export const SHEET_ACTIVE_OFFSET_Y = 12;
export const SHEET_FAIL_OFFSET_X = 16;
/** The springs and fades, from the expo-animation skill's tables (no approximated values). */
export const SHEET_SETTLE = Object.freeze({ duration: 300, dampingRatio: 1 });
export const SHEET_RELEASE = Object.freeze({ duration: 300, dampingRatio: 0.8 });
export const SHEET_REVEAL_MS = 180;
export const SHEET_REDUCED_FADE_MS = 150;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Where a new subject's content starts its reveal: never from nothing, so nothing flashes. */
const REVEAL_FROM = 0.35;

// The accepted COSMOS tokens (CosmosWorldView, the V5 card): the night, ink, the quiet grey, gold, the hairline. The sheet's
// night is OPAQUE (the V5 card's 0.94 glass let the live canvas's labels, chips and rings read through the text on the HONOR).
const C = { solid: 'rgb(11, 13, 26)', ink: '#E9EAF4', quiet: '#9A9DB4', gold: '#ECCC8A', hair: 'rgba(233, 234, 244, 0.16)', lift: '0px -10px 28px rgba(0, 0, 0, 0.42)' } as const;
const RADIUS = 24;
const GRABBER = { width: 36, height: 4 } as const;

type SheetAction = 'expand' | 'collapse' | 'close';

export interface CosmosDetailSheetProps {
  readonly phase: SheetPhase;
  /** A drag or a handle action settled here (the host's `useDetailSheet().settle`, a stable function). */
  readonly onSettle: (phase: SheetPhase) => void;
  /** The surface's glass: the sheet spans from its top inset (the band's bottom) to its bottom edge. */
  readonly glass: ViewportEnvelope;
  readonly language: ChromeLanguage;
  /** Whether this world has an EXPANDED phase at all (Personal: no, G-7). It is offered only when the content overflows. */
  readonly allowExpanded: boolean;
  /** Whether the PEEK's body drags. False when the content brings its own scroller (the Public discussion): the handle only. */
  readonly bodyDrags?: boolean;
  /** The identity of what the sheet is about (the host's content group): a new subject's content is revealed. */
  readonly subject?: string | null;
  /** Whether the sheet is about ONE focused item: its top carries the focused mark's gold hairline. */
  readonly accent?: boolean;
  /** The PEEK's visible height whenever the sheet is open (0 when closed): the stage's presentation lift (SD-10). */
  readonly onPeek?: (visible: number) => void;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function CosmosDetailSheet({
  phase, onSettle, glass, language, allowExpanded, bodyDrags = true, subject = null, accent = false, onPeek, children, testID = COSMOS_SHEET_TEST_ID,
}: CosmosDetailSheetProps) {
  const copy = useMemo(() => cosmosProductCopy(language), [language]);
  const reduced = useReducedMotion() === true;
  const room = Math.max(0, glass.height - glass.insetTop);
  const [measured, setMeasured] = useState(0);
  const geometry = useMemo(() => sheetGeometry(room, measured, glass.insetBottom), [room, measured, glass.insetBottom]);
  // EXPANDED is a stop when the content overflows the PEEK, and while the sheet is expanded (a content that asked to be
  // read expanded — the discussion — is not shrunk under the reader before it has measured).
  const expandable = allowExpanded && geometry.overflows;
  const shown: SheetPhase = phase === 'EXPANDED' && !allowExpanded ? 'PEEK' : phase;
  const stopsGeometry = useMemo<SheetGeometry>(() => (shown === 'EXPANDED' ? { ...geometry, overflows: true } : geometry), [shown, geometry]);
  const to = sheetOffset(shown, geometry);

  // The content once overflowed, now does not: an expanded sheet over a content that fits settles in PEEK.
  const wasExpandable = useRef(expandable);
  useEffect(() => {
    const before = wasExpandable.current;
    wasExpandable.current = expandable;
    if (before && !expandable && shown === 'EXPANDED') onSettle('PEEK');
  }, [expandable, shown, onSettle]);

  const visible = shown === 'CLOSED' ? 0 : geometry.peek;
  useEffect(() => { onPeek?.(visible); }, [onPeek, visible]);

  // The UI runtime's copy of what a drag needs; written here (effects), read by the worklets.
  const offset = useSharedValue(room);
  const target = useSharedValue(room);
  const begin = useSharedValue(room);
  const surface = useSharedValue(1);
  const reveal = useSharedValue(1);
  const live = useSharedValue<{ readonly phase: SheetPhase; readonly geometry: SheetGeometry; readonly allow: boolean; readonly reduced: boolean }>(
    { phase: shown, geometry: stopsGeometry, allow: allowExpanded, reduced },
  );
  // The phase the host was last told (or set itself). A drag's new phase is told when its move SETTLES, so the host's
  // re-render never lands while the sheet is still travelling. HONOR (2026-11-16, final review): told at release, the
  // commit of EXPANDED → PEEK held one frame for 83–99 ms, with ~270 px of travel still to go.
  const told = useSharedValue<SheetPhase>(shown);
  useLayoutEffect(() => {
    told.set(shown);
    live.set({ phase: shown, geometry: stopsGeometry, allow: allowExpanded, reduced });
    const from = target.get();
    if (from === to) return;
    target.set(to);
    cancelAnimation(offset);
    if (reduced) {
      offset.set(to);
      // Reduce Motion keeps the one change that explains itself: an opening fades in where it will rest.
      if (from >= room && to < room) { surface.set(0); surface.set(withTiming(1, { duration: SHEET_REDUCED_FADE_MS, easing: EASE_OUT })); }
      return;
    }
    surface.set(1);
    offset.set(withSpring(to, { ...SHEET_SETTLE, overshootClamping: true }));
  }, [told, live, shown, stopsGeometry, allowExpanded, reduced, target, offset, surface, to, room]);

  // A new subject brings its content in; the first subject rides in with the sheet itself.
  const lastSubject = useRef(subject);
  useLayoutEffect(() => {
    const before = lastSubject.current;
    lastSubject.current = subject;
    if (before === subject || before === null || subject === null) return;
    cancelAnimation(reveal);
    reveal.set(REVEAL_FROM);
    reveal.set(withTiming(1, { duration: SHEET_REVEAL_MS, easing: EASE_OUT }));
  }, [subject, reveal]);

  const drag = useCallback((id: string, enabled: boolean) => Gesture.Pan()
    .withTestId(id)
    .enabled(enabled)
    .activeOffsetY([-SHEET_ACTIVE_OFFSET_Y, SHEET_ACTIVE_OFFSET_Y])
    .failOffsetX([-SHEET_FAIL_OFFSET_X, SHEET_FAIL_OFFSET_X])
    .onStart(() => {
      // Grabbed mid-flight: the drag continues from where the eye last saw the sheet.
      cancelAnimation(offset);
      begin.set(offset.get());
    })
    .onUpdate((event) => {
      const at = live.get();
      offset.set(dragOffset(begin.get() + event.translationY, at.geometry, sheetStops(at.geometry, at.allow)));
    })
    .onEnd((event) => {
      const at = live.get();
      const stops = sheetStops(at.geometry, at.allow);
      const next = snapPhase({ from: at.phase, travel: event.translationY, velocity: event.velocityY, geometry: at.geometry, stops });
      const end = sheetOffset(next, at.geometry);
      target.set(end);
      // The UI runtime knows the new phase at once (a grab mid-flight snaps from it); the host is told when it settles.
      if (next !== at.phase) live.set({ ...at, phase: next });
      // Momentum may settle into PEEK; it never passes the closed edge or the top beneath the band.
      offset.set(at.reduced ? end : withSpring(end, { ...SHEET_RELEASE, velocity: event.velocityY, overshootClamping: next !== 'PEEK' }, (finished) => {
        'worklet';
        // An interrupted move tells nothing: the next drag's own settle tells the phase it ends in.
        if (finished === true && told.get() !== next) { told.set(next); scheduleOnRN(onSettle, next); }
      }));
      if (at.reduced && told.get() !== next) { told.set(next); scheduleOnRN(onSettle, next); }
    })
    .onFinalize((_event, success) => {
      // A drag the system took away (or a touch that never became one) returns to where the phase is.
      if (success === true || offset.get() === target.get()) return;
      const at = live.get();
      const settled = (finished?: boolean) => {
        'worklet';
        if (finished === true && told.get() !== at.phase) { told.set(at.phase); scheduleOnRN(onSettle, at.phase); }
      };
      if (at.reduced) { offset.set(target.get()); settled(true); return; }
      offset.set(withSpring(target.get(), { ...SHEET_SETTLE, overshootClamping: true }, settled));
    }), [begin, live, offset, onSettle, target, told]);
  // Gestures are memoised: rebuilding one per render can reattach the recogniser and drop a drag mid-flight.
  const handlePan = useMemo(() => drag(COSMOS_SHEET_HANDLE_GESTURE_TEST_ID, shown !== 'CLOSED'), [drag, shown]);
  const bodyPan = useMemo(() => drag(COSMOS_SHEET_BODY_GESTURE_TEST_ID, shown === 'PEEK' && bodyDrags), [drag, shown, bodyDrags]);
  // The keyboard's lift of a PEEK (keyboardLift): a second value beside the offset, so drags and snaps are unchanged.
  const lift = useSharedValue(0);
  const moving = useAnimatedStyle(() => ({ opacity: surface.get(), transform: [{ translateY: offset.get() - lift.get() }] }));
  const revealing = useAnimatedStyle(() => ({ opacity: reveal.get() }));

  // The PEEK is the content's top: collapsing returns the scroller to it.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => { if (shown !== 'EXPANDED') scroller.current?.scrollTo({ y: 0, animated: false }); }, [shown]);

  // The keyboard covers the sheet's bottom only where the window did not already resize above it.
  const frame = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const shownSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const top = event.endCoordinates.screenY;
      const node = frame.current;
      if (node === null) return;
      node.measureInWindow((_x, y, _w, h) => setOverlap(keyboardOverlap(y + h, top)));
    });
    const hiddenSub = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => { shownSub.remove(); hiddenSub.remove(); };
  }, []);
  const lifted = keyboardLift(shown, overlap, glass.insetBottom, geometry);
  useEffect(() => {
    cancelAnimation(lift);
    lift.set(reduced ? lifted : withTiming(lifted, { duration: SHEET_SETTLE.duration, easing: EASE_OUT }));
  }, [lift, lifted, reduced]);

  const can: Readonly<Record<SheetAction, boolean>> = {
    expand: shown === 'PEEK' && expandable,
    collapse: shown === 'EXPANDED',
    close: shown !== 'CLOSED',
  };
  const run = (action: SheetAction) => {
    if (!can[action]) return;
    onSettle(action === 'expand' ? 'EXPANDED' : action === 'collapse' ? 'PEEK' : 'CLOSED');
  };
  const primary: SheetAction | null = can.collapse ? 'collapse' : can.expand ? 'expand' : can.close ? 'close' : null;
  const words: Readonly<Record<SheetAction, string>> = { expand: copy.sheetExpand, collapse: copy.sheetCollapse, close: copy.sheetClose };
  const actions = (['expand', 'collapse', 'close'] as const).filter((action) => can[action]).map((action) => ({ name: action, label: words[action] }));
  const onAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === 'expand' || name === 'collapse' || name === 'close') run(name);
  };
  const closed = shown === 'CLOSED';
  const expanded = shown === 'EXPANDED';

  return (
    <View ref={frame} pointerEvents="box-none" style={[styles.frame, { top: glass.insetTop, height: room }]}>
      <Animated.View testID={testID} pointerEvents={closed ? 'none' : 'auto'}
        importantForAccessibility={closed ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={closed}
        accessibilityViewIsModal={expanded} onAccessibilityEscape={() => run(expanded ? 'collapse' : 'close')}
        style={[styles.surface, { height: room }, moving]}>
        {accent ? <View testID={COSMOS_SHEET_ACCENT_TEST_ID} style={styles.accent} /> : null}
        <GestureDetector gesture={handlePan}>
          <Pressable testID={COSMOS_SHEET_HANDLE_TEST_ID} accessibilityRole="button" accessibilityLanguage={language}
            accessibilityLabel={primary === null ? undefined : words[primary]} accessibilityState={{ expanded, disabled: primary === null }}
            accessibilityActions={actions} onAccessibilityAction={onAction} onPress={() => { if (primary !== null) run(primary); }}
            hitSlop={{ top: 8, bottom: 8 }} pressRetentionOffset={16} style={styles.handle}>
            {({ pressed }) => <View style={[styles.grabber, pressed ? styles.grabberPressed : null]} />}
          </Pressable>
        </GestureDetector>
        <GestureDetector gesture={bodyPan}>
          <Animated.ScrollView ref={scroller} testID={COSMOS_SHEET_SCROLL_TEST_ID} scrollEnabled={expanded} style={[styles.scroller, revealing]}
            onContentSizeChange={(_width: number, height: number) => setMeasured(Math.round(height))} keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false} showsVerticalScrollIndicator={expanded} indicatorStyle="white">
            {children}
          </Animated.ScrollView>
        </GestureDetector>
        {overlap > 0 ? <View style={{ height: overlap }} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 0, right: 0 },
  surface: {
    backgroundColor: C.solid, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderColor: C.hair, boxShadow: C.lift,
  },
  accent: { position: 'absolute', top: 0, left: RADIUS + 4, right: RADIUS + 4, height: StyleSheet.hairlineWidth, backgroundColor: C.gold, opacity: 0.7 },
  handle: { height: SHEET_HANDLE_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: GRABBER.width, height: GRABBER.height, borderRadius: GRABBER.height / 2, backgroundColor: C.quiet, opacity: 0.55 },
  grabberPressed: { backgroundColor: C.ink, opacity: 0.9 },
  scroller: { flex: 1 },
});

/**
 * The stage beneath the sheet: while the sheet is EXPANDED the stage stays mounted (the same canvas, the same camera)
 * but takes no touch and is hidden from accessibility (§19.3). Nothing is re-keyed by the phase.
 *
 * The stage is never flattened (`collapsable={false}`). Without that, it is a style-only view in PEEK, and Fabric
 * flattens it away; the props of EXPANDED make it a real native view again. Every flip then re-parents the whole
 * stage, so the canvas's TextureView loses its surface and draws a new one. On the HONOR (closure pass, 2026-11-16) a
 * traced EXPANDED → PEEK commit showed exactly that: REMOVE 13 / INSERT 13, the SurfaceTexture disconnected and a new
 * one connected, and a 58 ms frame with 48 ms of `Record View#draw`.
 */
export function CosmosSheetStage({ expanded, children }: { readonly expanded: boolean; readonly children: ReactNode }) {
  return (
    <View testID={COSMOS_SHEET_STAGE_TEST_ID} collapsable={false} style={{ flex: 1 }} pointerEvents={expanded ? 'none' : 'auto'}
      importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={expanded}>
      {children}
    </View>
  );
}

/**
 * SD-12 — the same owner, telling its host when the reader focused something on the stage (a tap the owner answered
 * `FOCUS`, or an accessible mark activated), so the host can show a closed sheet again. Every act is the owner's own,
 * unchanged and in the same order; this only listens. One per owner (memoise it on the owner).
 */
export function reopeningOwner(owner: CosmosWorldOwner, reopen: () => void): CosmosWorldOwner {
  return {
    ...owner,
    tap: (x, y, released) => {
      const result = owner.tap(x, y, released);
      if (result === 'FOCUS') reopen();
      return result;
    },
    focus: (id) => {
      owner.focus(id);
      reopen();
    },
  };
}
