/**
 * COSMOS-INT-01 Slice B — the COSMOS stage as a world of the ONE Living Analysis surface.
 *
 * One full-surface cosmic stage (`CosmosCanvas`, the look and motion the Product Owner accepted on the HONOR) and, over
 * it, the stage's own light chrome: the depth rail (right; left in RTL), the Back pill and the presentation-only
 * Overview below the host's top band, the nearest-place note when a known world has nothing in this region, and the
 * Personal register of objects the derivation disclosed with no place (G-6). Everything else the reader is told — the
 * panel, the search, the T-08 orientation, Return, the Timeline, "nothing here yet", "could not be shown" — is the
 * host's and the chrome band's, exactly as before: this view adds no sentence the production chrome already says.
 *
 * The authority is the owner's (`./owner-core`): this view only relays what the fingers did and eases the stage to the
 * camera the authority answered with. It writes no canonical camera, no store, no controller.
 *
 * Overview (Product Owner authorisation, 2026-11-15: "top Overview" is preserved) is PRESENTATION ONLY: it eases the
 * presentation camera out until every entity the client holds is in view; it dispatches NOTHING; entity taps are
 * disabled while it is on; any tap, gesture end or Back returns to the canonical camera.
 *
 * Motion is COSMOS's (D-5): the settle, the pinch about the fingers and the drift. T-10's arrival choreography is not
 * played here; the composite binding is still consumed by the Personal owner so no cause is ever borrowed.
 *
 * Slice C (Contract v1.3 §15): the host brings the rest of the accepted chrome through three seams — `rail` (what lies
 * along the bottom edge: the Personal timeline rail), `acts` (the compact contextual controls, in a row under the top
 * row) and `home` (the canonical act behind the Back chip at the first rung, away from the centre: the Personal
 * world's T-07 Return to World; without it the chip pans to the centre, as the fields do). The view decides nothing more.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { envelopeCenter, type ScreenPoint, type ViewportEnvelope } from '../../map/camera';
import type { ChromeLanguage } from '../../orientation-chrome';
import { absenceOf, type NasijAbsence } from '../core/absence';
import { zoomAbout, type NasijCamera } from '../core/camera';
import type { WorldKind } from '../core/stage';
import { CosmosCanvas, type CosmosCanvasHandle } from '../skia/CosmosCanvas';
import { cosmosProductCopy } from './copy';
import { viewOf, type CosmosWorldOwner } from './owner-core';

export const COSMOS_WORLD_VIEW_TEST_ID = 'qandeel-cosmos-world';
export const COSMOS_BACK_TEST_ID = 'qandeel-cosmos-back';
export const COSMOS_OVERVIEW_TEST_ID = 'qandeel-cosmos-overview';
export const COSMOS_RAIL_TEST_ID = 'qandeel-cosmos-rail';
export const COSMOS_REGISTER_TEST_ID = 'qandeel-cosmos-register';
/** §16 A-2: the slot under the Overview chip that holds the host's Return to World while Overview is on. */
export const COSMOS_OVERVIEW_COMPANION_TEST_ID = 'qandeel-cosmos-overview-companion';
export const COSMOS_NEAREST_TEST_ID = 'qandeel-cosmos-nearest';
export { COSMOS_MARK_TEST_ID_INFIX, COSMOS_STEP_TEST_ID_SUFFIX } from '../skia/CosmosCanvas';
/** One served relation's accessible name (S5-03C): `${testID}${COSMOS_RELATION_TEST_ID_INFIX}${relationId}`. */
export const COSMOS_RELATION_TEST_ID_INFIX = ':relation:';

/** Slice C: the register stands above the rail's rows (the line, the 44-point segments row, the 44-point words row). */
const RAIL_CLEARANCE = 128;

/** D-9: a second tap within this window on nothing is one canonical zoom-IN step at the tapped point. */
const DOUBLE_TAP_MS = 320;
/**
 * The usable centre of the glass (PO, 2026-11-16; contract §18): across, the glass's own centre; down, midway between
 * the bottom of the stage's top controls and the top of the host's rail as they are laid out now. A row not laid out
 * yet (or not drawn) gives way to the glass's own band.
 */
export function usableCentre(glass: ViewportEnvelope, controlsBottom: number | null, railTop: number | null): ScreenPoint {
  const top = controlsBottom ?? glass.insetTop;
  const bottom = railTop ?? glass.height - glass.insetBottom;
  return { x: envelopeCenter(glass).x, y: bottom > top ? (top + bottom) / 2 : envelopeCenter(glass).y };
}

/** The rail's place at rest (36 % down the glass, as accepted). */
const RAIL_TOP_SHARE = 0.36;
/** The room under Overview's companion (§16 A-2: 48 points below the chip's row) and the gap kept above the rail. */
const COMPANION_ROOM = 48;
const RAIL_GAP = 8;
/**
 * Slice E D-3 (PO D-c / D-d, 2026-11-18): the depth rail's top. It keeps its accepted place unless the top controls (and
 * Overview's companion, where the host offers one) reach it: then it stands just below them, on the same right edge.
 * Before the controls are laid out, the accepted place.
 */
export function railTopOf(glassHeight: number, controlsEnd: number | null, companion: boolean): number {
  const accepted = glassHeight * RAIL_TOP_SHARE;
  if (controlsEnd === null) return accepted;
  return Math.max(accepted, controlsEnd + (companion ? COMPANION_ROOM : 0) + RAIL_GAP);
}

const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

// The stage's own glass palette, as accepted on the device.
const C = { void: '#05060f', ink: '#E9EAF4', quiet: '#9A9DB4', gold: '#ECCC8A', goldDim: 'rgba(236, 204, 138, 0.38)', glass: 'rgba(11, 13, 26, 0.62)', hair: 'rgba(233, 234, 244, 0.16)' } as const;

export interface CosmosWorldViewProps {
  readonly owner: CosmosWorldOwner;
  readonly world: WorldKind;
  readonly language: ChromeLanguage;
  /** The glass the host measured and steadied (CA-O1): its bands are the insets; the stage fills it. */
  readonly glass: ViewportEnvelope;
  /** The slow drift of the atmosphere at rest; off while a live call shares the Analysis surface. */
  readonly drift?: boolean;
  /** The stage's accessible label: the world's approved field / map label. */
  readonly worldLabel: string;
  readonly zoomInLabel: string;
  readonly zoomOutLabel: string;
  /** False when a production accessibility layer (the Personal Map's) stands in for the stage's own marks and actions. */
  readonly accessibleMarks?: boolean;
  /** What the host lays over the stage (its accessibility layer, its composition mark). */
  readonly children?: ReactNode;
  /** Slice C: what the host lays along the bottom edge, in the glass (the Personal timeline rail). */
  readonly rail?: ReactNode;
  /** Slice C (§16 A-2): the host's canonical Return to World, drawn under the Overview chip while Overview is on (null when not offered). */
  readonly overviewAct?: ReactNode;
  /** Slice C: the canonical act behind the Back chip at the first rung, away from the centre (Personal: T-07 Return to World). */
  readonly home?: () => void;
  readonly testID?: string;
}

export function CosmosWorldView({ owner, world, language, glass, drift = true, worldLabel, zoomInLabel, zoomOutLabel, accessibleMarks = true, children, rail = null, overviewAct = null, home, testID = COSMOS_WORLD_VIEW_TEST_ID }: CosmosWorldViewProps) {
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot);
  const copy = useMemo(() => cosmosProductCopy(language), [language]);
  const rtl = language === 'ar';
  const canvas = useRef<CosmosCanvasHandle>(null);
  const glassRef = useRef(glass);
  // The authority projects through the glass the host measured, before anything is drawn against it.
  useLayoutEffect(() => { glassRef.current = glass; owner.setGlass(glass); }, [owner, glass]);
  const view = useMemo(() => viewOf(glass), [glass]);
  const focusY = view.focusY;

  // ── Overview: PRESENTATION ONLY (see the header). Nothing below this line writes a canonical camera. ─────────────
  const [overviewOn, setOverviewOn] = useState(false);
  const overviewRef = useRef(false);
  const overview = overviewOn;

  // A world's first READY stage: the camera is placed, not animated.
  const placed = useRef<CosmosWorldOwner | null>(null);
  useEffect(() => {
    if (snapshot.status !== 'READY' || placed.current === owner) return;
    placed.current = owner;
    canvas.current?.jumpTo(snapshot.camera, focusY);
  }, [snapshot, owner, focusY]);

  // The canonical camera moved (an act just answered, a restore, a glass change): ease the stage to it.
  const keepAnchor = useRef(false);
  const { cx, cy, scale } = snapshot.camera;
  useEffect(() => {
    if (placed.current !== owner || overviewRef.current) return;
    canvas.current?.settleTo({ cx, cy, scale }, focusY, { keepAnchor: keepAnchor.current });
    keepAnchor.current = false;
  }, [cx, cy, scale, focusY, owner]);

  /** After an act: settle at once to whatever the authority now holds (also when the act moved nothing). */
  const settleNow = useCallback((aboutFingers = false) => {
    const at = owner.getSnapshot();
    keepAnchor.current = aboutFingers;
    canvas.current?.settleTo(at.camera, viewOf(glassRef.current).focusY, { keepAnchor: aboutFingers });
  }, [owner]);

  const leaveOverview = useCallback(() => {
    if (!overviewRef.current) return false;
    overviewRef.current = false;
    setOverviewOn(false);
    settleNow();
    return true;
  }, [settleNow]);
  const enterOverview = useCallback(() => {
    const at = owner.getSnapshot();
    const v = viewOf(glassRef.current);
    const bounds = at.list.bounds;
    if (bounds === null || at.status !== 'READY') return;
    const margin = 110; // points kept free around the entities, for their light and their titles
    const fit = Math.min((v.width - margin) / Math.max(1, bounds.maxX - bounds.minX), (v.height - margin * 2.4) / Math.max(1, bounds.maxY - bounds.minY));
    const framed: NasijCamera = { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2, scale: Math.max(0.02, Math.min(at.camera.scale, fit)) };
    overviewRef.current = true;
    setOverviewOn(true);
    canvas.current?.settleTo(framed, v.focusY);
  }, [owner]);
  // A new owner starts from its own camera: no overview is carried into it.
  useEffect(() => () => { overviewRef.current = false; }, [owner]);

  const onPanEnd = useCallback((released: NasijCamera) => {
    if (leaveOverview()) return;
    owner.pan(released);
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  // A pinch ends ABOUT THE FINGERS (Product Owner finding, 2026-11-15): the pan part of the gesture is committed first,
  // at the current rung's scale with the fingers' point still under the fingers, then the step is asked for with the
  // fingers as its focal; the settle keeps the anchor in every case. Nothing canonical is decided here.
  // Where the chrome is laid out, read by a pinch's end only (refs: a layout writes no state and renders nothing).
  const controlsBottom = useRef<number | null>(null);
  const railTop = useRef<number | null>(null);
  // Slice E D-3 (PO D-c / D-d, 2026-11-18): the depth rail stands below the top controls (and Overview's companion), never
  // under them or under the host's band. Whole points only, so sub-point noise is never a relayout.
  const [controlsEnd, setControlsEnd] = useState<number | null>(null);
  const onControlsLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    controlsBottom.current = y + height;
    const end = Math.ceil(y + height);
    setControlsEnd((current) => (current === end ? current : end));
  }, []);
  const onRailLayout = useCallback((event: LayoutChangeEvent) => { railTop.current = event.nativeEvent.layout.y; }, []);
  useEffect(() => { if (rail === null) railTop.current = null; }, [rail]);
  const onPinchEnd = useCallback((direction: 'IN' | 'OUT' | null, fx: number, fy: number, released: NasijCamera) => {
    if (leaveOverview()) return;
    const at = owner.getSnapshot();
    const atRung = zoomAbout(released, viewOf(glassRef.current), fx, fy, at.camera.scale);
    owner.pan(atRung);
    if (direction === null) { settleNow(true); return; }
    // The usable centre goes with a pinch only; the owner decides whether a target is named (Personal: §18).
    const aim = usableCentre(glassRef.current, controlsBottom.current, railTop.current);
    const result = owner.step(direction, { x: fx, y: fy }, atRung, aim);
    settleNow(result.applied ? result.aboutFingers : true);
  }, [leaveOverview, owner, settleNow]);
  const lastTap = useRef(0);
  const onTap = useCallback((x: number, y: number, released: NasijCamera) => {
    if (leaveOverview()) return; // entity taps are disabled in the overview: the tap only returns
    const result = owner.tap(x, y, released);
    if (result === 'NONE') {
      const at = now();
      if (at - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; const stepped = owner.step('IN', { x, y }, released); settleNow(stepped.aboutFingers); return; }
      lastTap.current = at;
    } else lastTap.current = 0;
    settleNow();
  }, [leaveOverview, owner, settleNow]);

  const stepBy = useCallback((direction: 'IN' | 'OUT') => { leaveOverview(); owner.step(direction, null, null); settleNow(); }, [leaveOverview, owner, settleNow]);
  const zoomIn = useCallback(() => stepBy('IN'), [stepBy]);
  const zoomOut = useCallback(() => stepBy('OUT'), [stepBy]);
  const activate = useCallback((id: string) => { if (leaveOverview()) return; owner.focus(id); settleNow(); }, [leaveOverview, owner, settleNow]);
  const labelOf = useCallback((id: string) => owner.labelOf(id), [owner]);
  // At the first rung, away from the centre, the chip is the host's canonical act when it has one (Slice C, D-3: the
  // Personal RETURN_WORLD, recorded and observed like every T-07 act); otherwise the pan to the centre.
  const back = useCallback(() => {
    if (leaveOverview()) return;
    const at = owner.getSnapshot();
    if (!owner.back() && at.rung === 0) {
      if (home !== undefined) home();
      else owner.goTo(0, 0);
    }
    settleNow();
  }, [leaveOverview, owner, settleNow, home]);
  const toRung = useCallback((rung: number) => {
    leaveOverview();
    let at = owner.getSnapshot().rung;
    while (at > rung) {
      const applied = owner.step('OUT', null, null).applied;
      const next = owner.getSnapshot().rung;
      if (!applied || next === at) break;
      at = next;
    }
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  const toNearest = useCallback((x: number, y: number) => { leaveOverview(); owner.goTo(x, y); settleNow(); }, [leaveOverview, owner, settleNow]);

  const absence: NasijAbsence = absenceOf({ status: snapshot.status, shown: snapshot.shown, worldIndex: snapshot.worldIndex }, snapshot.camera, view);
  const names = copy.rungs[snapshot.world];
  // The pill names where it returns to: the shallower rung, or the world's centre at the first rung. It stands down at
  // home, and in the overview (where the selected Overview chip, any tap or any gesture is the way back).
  const atHome = overview || (snapshot.rung === 0 && snapshot.camera.cx === 0 && snapshot.camera.cy === 0);
  // U-9: the Back chip stands at the left in both languages, so its arrow points the one way it leads.
  const backText = snapshot.rung > 0 ? `← ${names[snapshot.rung - 1]}` : copy.wholeWorld;
  const bearing = absence.kind === 'REGION_EMPTY' ? absence.bearing : null;

  // Nothing here is mirrored by language (Product Owner, 2026-11-15, §16 U-9): Back left, Overview right (its
  // companion under it), the depth rail right, the register left, in Arabic exactly as in English. The root pins the
  // layout direction so a host under native RTL mirroring (the Shared / Public fields; the Conversation surface already
  // pins `ltr`) renders the same accepted layout in every world. (HONOR proof, 2026-11-15: without this the Shared /
  // Public rail label sat outboard and was clipped at the edge.) Arabic words keep their own reading direction.
  return (
    <View style={styles.root} testID={testID}>
      <CosmosCanvas
        ref={canvas}
        world={world}
        stage={snapshot.list}
        held={snapshot.held}
        rung={snapshot.rung}
        rtl={rtl}
        initialCamera={snapshot.camera}
        mode="FULL"
        drift={drift}
        onPanEnd={onPanEnd}
        onPinchEnd={onPinchEnd}
        onTap={onTap}
        accessibilityLabel={`${worldLabel} · ${names[snapshot.rung] ?? ''}`}
        zoomInLabel={zoomInLabel}
        zoomOutLabel={zoomOutLabel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        labelOf={labelOf}
        onActivate={activate}
        accessibleMarks={accessibleMarks}
        testID={testID}
      />
      {children}

      {/* S5-03C: the focused entity's served relations keep their accessible names (the strand itself is drawn in the stage). */}
      {snapshot.relations.map((relation) => (
        <View key={relation.id} testID={`${testID}${COSMOS_RELATION_TEST_ID_INFIX}${relation.id}`} accessible accessibilityLabel={relation.label} pointerEvents="none" style={styles.relation} />
      ))}

      {/* Below the host's top band: Back (the shallower rung, or the world's centre) at the left and Overview at the right, in both languages (U-1, U-9). */}
      <View pointerEvents="box-none" onLayout={onControlsLayout} style={[styles.top, { top: glass.insetTop + 6, left: glass.insetLeft + 12, right: glass.insetRight + 12 }]}>
        {/* Slice E D-3, E-1 option (a) (PO, 2026-11-18): at home Back is hidden and disabled, so it takes no touch and is not
            announced, on both platforms (iOS already skipped an invisible view; Android did not). Away from home it is
            unchanged. It may shrink, its words wrapping, so Overview always keeps its own width on the screen. */}
        <Pressable testID={COSMOS_BACK_TEST_ID} accessibilityRole="button" accessibilityLabel={backText} disabled={atHome} onPress={back}
          pointerEvents={atHome ? 'none' : 'auto'} accessibilityElementsHidden={atHome} importantForAccessibility={atHome ? 'no-hide-descendants' : 'auto'}
          style={[styles.press, styles.backPress, atHome && styles.hidden]}>
          <View style={styles.chip}><Text style={styles.pillText}>{backText}</Text></View>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable testID={COSMOS_OVERVIEW_TEST_ID} accessibilityRole="button" accessibilityLabel={copy.overview} accessibilityState={{ selected: overview }}
          onPress={() => { if (!leaveOverview()) enterOverview(); }} style={[styles.press, styles.overviewPress]}>
          <View style={[styles.chip, overview && styles.chipOn]}><Text style={[styles.pillText, overview && styles.goldText]}>{copy.overview}</Text></View>
        </Pressable>
      </View>

      {/* §16 A-2: Overview's companion — the host's canonical Return to World — under the Overview chip, only while Overview is on. */}
      {overview && overviewAct !== null ? (
        <View testID={COSMOS_OVERVIEW_COMPANION_TEST_ID} pointerEvents="box-none" style={[styles.companion, { top: glass.insetTop + 6 + 48, right: glass.insetRight + 12 }]}>
          {overviewAct}
        </View>
      ) : null}

      {/* The depth rail: the current depth is the lit point; a shallower depth can be returned to. Product Owner override
          (2026-11-15): the rail stays on the RIGHT in both languages — its side is never mirrored in RTL; its design,
          labels, size and interactions are the accepted ones. The label sits inboard of its dot, as on the right rail. */}
      <View testID={COSMOS_RAIL_TEST_ID} pointerEvents="box-none" style={[styles.rail, { top: railTopOf(glass.height, controlsEnd, overviewAct !== null), right: glass.insetRight + 2 }]}>
        {/* Slice E D-3 (SE-FU-2): the line is drawn, never touched. */}
        <View pointerEvents="none" style={[styles.railLine, { right: 21.5 }]} />
        {names.map((name, i) => {
          const on = i === snapshot.rung;
          const past = i < snapshot.rung;
          return (
            // Slice E D-1 (iOS; PO 2026-11-18, consistent across the three worlds): the current depth's bead takes no touch
            // as a whole, not only its word (§18). UIKit gives a touch to the topmost view under the finger, and only that
            // view's recognizers and its ancestors' see it. The canvas detector is the bead's sibling, so a bead's own box,
            // which spans the word, would keep from the stage a touch it never acts on. Diag run 44255421709 proved this
            // for beads 3 and 2. The bead is disabled at the current depth, so it loses no act; a shallower bead keeps its
            // touch. Its accessibility and its appearance are unchanged. Slice E D-3 (SE-FU-2; diag run 44364253792): a deeper
            // bead, disabled too, took a drag meant for the stage in every World; it now takes no touch either.
            <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: on, disabled: !past }} disabled={!past}
              onPress={() => toRung(i)} style={styles.bead} pointerEvents={past ? undefined : 'none'}>
              {/* §18 (PO, 2026-11-16; extended to Shared and Public by the PO, 2026-11-18): the current depth's word takes
                  no touch, so a finger of a pinch that lands on it still reaches the stage (a centred target sits in its
                  band; the bead is disabled at the current depth, so no touch on the word ever did anything). */}
              {on ? (
                <View collapsable={false} pointerEvents="none">
                  <Text style={[styles.beadText, rtl && styles.beadTextArabic]}>{name}</Text>
                </View>
              ) : null}
              <View style={styles.beadSlot}>
                <View style={on ? styles.beadOn : [styles.beadDot, past && styles.beadPast]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* A known world with nothing in this region: the one absence the production chrome does not say. It speaks of the
          CANONICAL camera's region, so it stands down while Overview (presentation only) frames the whole world: there the
          reader sees every entry, and the card's sentence would contradict the picture (COSMOS E-2 HONOR acceptance, PO
          decision 2026-11-20). Leaving Overview returns to that region, and the card with it. */}
      {absence.kind !== 'REGION_EMPTY' || overview ? null : (
        <View pointerEvents="box-none" style={styles.absenceWrap}>
          {/* Slice E D-3 (SE-FU-2; diag run 44364253792): the card and its words take no touch, so a drag that starts on
              them still moves the stage; "Go to the nearest" keeps its own. Its live region and words are unchanged. */}
          <View accessibilityLiveRegion="polite" testID={COSMOS_NEAREST_TEST_ID} pointerEvents="box-none" style={styles.absence}>
            <View pointerEvents="none"><Text style={styles.absenceText}>{copy.regionEmpty}</Text></View>
            {bearing === null ? null : (
              <Pressable accessibilityRole="button" accessibilityLabel={copy.nearest} onPress={() => toNearest(snapshot.camera.cx + bearing.dx, snapshot.camera.cy + bearing.dy)} style={styles.absenceAct}>
                <Text style={[styles.goldText, { transform: [{ rotate: `${Math.atan2(bearing.dy, bearing.dx)}rad` }] }]}>➤</Text>
                <Text style={styles.goldText}>{copy.nearest}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* G-6: the Personal objects disclosed with no place, at the start of the bottom edge, inspectable; no name is invented. */}
      {snapshot.unplaced.length === 0 ? null : (
        <View testID={COSMOS_REGISTER_TEST_ID} pointerEvents="box-none"
          style={[styles.register, { bottom: glass.insetBottom + 10 + (rail === null ? 0 : RAIL_CLEARANCE), left: glass.insetLeft + 10 }]}>
          {snapshot.unplaced.map((item) => {
            const on = item.id === snapshot.inspectedId;
            return (
              <Pressable key={item.id} testID={`${COSMOS_REGISTER_TEST_ID}:${item.id}`} accessibilityRole="button" accessibilityLabel={owner.labelOf(item.id)}
                accessibilityState={{ selected: on }} onPress={() => activate(item.id)} style={styles.beadSlot}>
                <View style={on ? styles.beadOn : styles.beadDot} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Slice C: the host's rail along the bottom edge, in the glass, at the proof's own place (`bottom = inset + 12`, 18-point gutters). */}
      {rail === null ? null : (
        <View pointerEvents="box-none" onLayout={onRailLayout} style={[styles.railWrap, { bottom: glass.insetBottom + 12, left: glass.insetLeft + 18, right: glass.insetRight + 18 }]}>
          {rail}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void, direction: 'ltr' },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
  companion: { position: 'absolute', alignItems: 'flex-end' },
  railWrap: { position: 'absolute' },
  spacer: { flex: 1 },
  hidden: { opacity: 0 },
  // T12-A95: every press target is at least 44 points; the accepted 40-point pill sits inside it.
  press: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  backPress: { flexShrink: 1 },
  overviewPress: { flexShrink: 0 },
  pillText: { fontSize: 13, color: C.ink },
  // ONE chip for Back and Overview (Product Owner, 2026-11-16: consistent proportions, spacing and touch targets in the one row).
  chip: { minHeight: 40, minWidth: 44, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: C.gold },
  goldText: { fontSize: 13, color: C.gold },
  rail: { position: 'absolute' },
  railLine: { position: 'absolute', top: 22, bottom: 22, width: 1, backgroundColor: C.goldDim },
  // Slice E D-1 (iOS): a bead is as wide as what it draws, at the rail's right edge (`alignSelf`), not stretched to the
  // widest bead. The pixels do not move: the content was already right-aligned. Stretched, every bead was a
  // rail-wide box (Personal on an iPhone 17: 179 x 44 each, 179 x 220 together) standing over the stage. On iOS, UIKit
  // gives a touch to that topmost box, and the canvas detector (its sibling) never sees it. Diag run 44255421709: a node
  // tap at 323,475 and a pan from 281,437 reached beads 3 and 2 and not the canvas.
  bead: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, alignSelf: 'flex-end' },
  beadSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  beadDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.void, borderWidth: 1, borderColor: C.goldDim },
  beadPast: { backgroundColor: C.goldDim },
  beadOn: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.gold, borderWidth: 4, borderColor: 'rgba(236, 204, 138, 0.3)' },
  beadText: { fontSize: 10, letterSpacing: 1.8, color: C.gold, textShadowColor: C.void, textShadowRadius: 8, textTransform: 'uppercase' },
  beadTextArabic: { fontSize: 13, letterSpacing: 0, textTransform: 'none' },
  relation: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0 },
  absenceWrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  absence: { maxWidth: '76%', alignItems: 'center', backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  absenceText: { fontSize: 16, lineHeight: 24, color: C.ink, textAlign: 'center' },
  absenceAct: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  register: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', maxWidth: '60%' },
});
