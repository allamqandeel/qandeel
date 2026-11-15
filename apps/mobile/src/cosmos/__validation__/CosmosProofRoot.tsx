// COSMOS proof (experimental, isolated) — the proof root. VALIDATION ONLY. WRITTEN WITHOUT A DEVICE.
//
// One full-screen cosmic stage and, over it, the proof's chrome: the three worlds, Arabic / English, the depth rail,
// Back, the five absence states, the card at a fixed peek height, the Personal position ticks and unplaced count, and
// a Measurements sheet (the reason this build exists): overdraw modes, frame probe, open times, a mount/unmount cycle.
//
// EVERYTHING SHOWN IS A LABELLED SYNTHETIC FIXTURE, and the screen says so at all times. The authority is production:
// each world's owner (`./owners`) drives the shipped controller, and this root only relays what the fingers did and
// eases the stage to the camera the authority answered with.
//
// EXPERIMENTAL DEPARTURE, FLAGGED FOR THE PRODUCT OWNER — "Overview". The Overview control is PRESENTATION ONLY: it eases
// the presentation camera out until every entity the client currently holds is in view (its scale may go below the
// first rung). It dispatches NOTHING to the canonical camera, the store or any controller; it shows a persistent
// "overview (presentation only)" tag; entity taps are disabled while it is on; and any tap, gesture end or Back returns
// to the canonical camera. No production surface has this, and it needs the Product Owner's approval before it could.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deviceProductLanguage } from '../../integration';
import { absenceOf, type NasijAbsence } from '../core/absence';
import { zoomAbout, type NasijCamera, type NasijView } from '../core/camera';
import { drawOpsAtRest, type WorldKind } from '../core/stage';
import { CosmosCanvas, OVERDRAW_MODES, type CosmosCanvasHandle, type MotionKind, type OverdrawMode, type ProbeResult } from '../skia/CosmosCanvas';
import { COSMOS_COPY, type CosmosCopy, type CosmosLanguage } from './copy';
import { COSMOS_FAULTS, type CosmosFault } from './fixture-transports';
import { collectRuntime, parseProofLink, readJsHeap, type JsHeapReading, type ProofLink } from './measure';
import { CARD_PEEK, createCosmosOwner, focusYOf, type CosmosCard, type CosmosTime, type CosmosWorldOwner, type CosmosWorldSnapshot } from './owners';

const WORLDS: readonly WorldKind[] = ['PERSONAL', 'SHARED', 'PUBLIC'];
const DOUBLE_TAP_MS = 320;
const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export const COSMOS_PROOF_ROOT_TEST_ID = 'cosmos-proof-root';
export const COSMOS_FIXTURE_LABEL_TEST_ID = 'cosmos-fixture-label';
export const COSMOS_OVERVIEW_TAG_TEST_ID = 'cosmos-overview-tag';
export const COSMOS_HUD_TEST_ID = 'cosmos-hud';

const C = { void: '#05060f', ink: '#E9EAF4', quiet: '#9A9DB4', gold: '#ECCC8A', goldDim: 'rgba(236, 204, 138, 0.38)', glass: 'rgba(11, 13, 26, 0.62)', solid: 'rgba(11, 13, 26, 0.94)', hair: 'rgba(233, 234, 244, 0.16)', title: '#FFF1D6' } as const;
const MODE_LABEL: Readonly<Record<OverdrawMode, string>> = { FULL: 'FULL', NO_BODIES: 'NO_BODIES', PLATES_ONLY: 'PLATES_ONLY' };

/** Opens of a world since the process started: the first decodes the assets (COLD), the rest are WARM. */
let processOpens = 0;

interface OpenRecord { readonly n: number; readonly world: WorldKind; readonly cold: boolean; readonly readyMs: number | null; readonly frameMs: number | null }
interface CycleState { readonly running: boolean; readonly done: number; readonly total: number; readonly before: JsHeapReading | null; readonly after: JsHeapReading | null }

export function CosmosProofRoot() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <CosmosProof />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function CosmosProof() {
  const insets = useSafeAreaInsets();
  const [world, setWorld] = useState<WorldKind>('PUBLIC');
  const [language, setLanguage] = useState<CosmosLanguage>(deviceProductLanguage);
  const [fault, setFault] = useState<CosmosFault>('NONE');
  const [visit, setVisit] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<OverdrawMode>('FULL');
  const [drift, setDrift] = useState(true);
  const [opaqueSurface, setOpaqueSurface] = useState(false);
  /** The owner the presentation-only overview is on for (a new world, language or visit starts from its own camera). */
  const [overviewKey, setOverviewKey] = useState<string | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(true);
  const copy = COSMOS_COPY[language];
  const rtl = language === 'ar';

  // One owner per (world, language, visit): entering a world inherits nothing from an earlier visit.
  const [faultBox] = useState(() => { let current: CosmosFault = 'NONE'; return { get: () => current, set: (next: CosmosFault) => { current = next; } }; });
  const make = (key: string, kind: WorldKind) => { processOpens += 1; return { key, made: now(), n: processOpens, it: createCosmosOwner(kind, { language, fault: faultBox.get }) }; };
  const ownerKey = `${world}:${language}:${visit}`;
  const [owner, setOwner] = useState(() => make(ownerKey, world));
  if (owner.key !== ownerKey) setOwner(make(ownerKey, world));
  const snapshot = useSyncExternalStore(owner.it.subscribe, owner.it.getSnapshot);
  const canvas = useRef<CosmosCanvasHandle>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const sizeRef = useRef(size);
  const overviewRef = useRef<string | null>(null);
  const overview = overviewKey === owner.key;

  // ── measurements ────────────────────────────────────────────────────────────────────────────────────────────────
  const [lastProbe, setLastProbe] = useState<Partial<Record<MotionKind, ProbeResult>>>({});
  const [probeLog, setProbeLog] = useState<readonly (ProbeResult & { readonly world: WorldKind })[]>([]);
  const [opens, setOpens] = useState<readonly OpenRecord[]>([]);
  const [cycle, setCycle] = useState<CycleState>({ running: false, done: 0, total: 0, before: null, after: null });
  const frameWaiter = useRef<(() => void) | null>(null);

  useEffect(() => {
    const it = owner.it;
    if (sizeRef.current !== null) it.setView(sizeRef.current.width, sizeRef.current.height);
    it.enter();
    return () => it.dispose();
  }, [owner]);

  const focusY = size === null ? 0 : focusYOf(snapshot, size.height);

  // OPEN TIME (a): from the user's switch (the owner's creation) to the authority's READY.
  const openOf = useRef<{ owner: CosmosWorldOwner; ready: boolean; frame: boolean } | null>(null);
  const noteOpen = useCallback((part: 'readyMs' | 'frameMs') => {
    const at = Math.round(now() - owner.made);
    setOpens((previous) => {
      const known = previous.find((record) => record.n === owner.n);
      const record: OpenRecord = { n: owner.n, world, cold: owner.n === 1, readyMs: known?.readyMs ?? null, frameMs: known?.frameMs ?? null, [part]: at };
      return [...previous.filter((r) => r.n !== owner.n), record].slice(-12);
    });
  }, [owner, world]);
  useEffect(() => {
    if (openOf.current?.owner !== owner.it) openOf.current = { owner: owner.it, ready: false, frame: false };
    if (snapshot.status !== 'READY' || openOf.current.ready) return;
    openOf.current.ready = true;
    noteOpen('readyMs');
  }, [snapshot.status, owner, noteOpen]);
  // OPEN TIME (b): to the first UI frame after a non-empty stage and its images were committed to the canvas.
  /** MEASUREMENT ONLY (candidate lifecycle fix, `gcauto/on`): ask the UI runtime to collect once a world is drawn. */
  const uiCollectPerOpen = useRef(false);
  const onFirstStageFrame = useCallback(() => {
    if (openOf.current?.owner === owner.it && !openOf.current.frame) { openOf.current.frame = true; noteOpen('frameMs'); }
    if (uiCollectPerOpen.current) collectRuntime('ui');
    frameWaiter.current?.();
  }, [owner, noteOpen]);

  // A new world's first READY stage: the camera is placed, not animated.
  const placed = useRef<CosmosWorldOwner | null>(null);
  useEffect(() => {
    if (snapshot.status !== 'READY' || size === null || placed.current === owner.it) return;
    placed.current = owner.it;
    canvas.current?.jumpTo(snapshot.camera, focusYOf(snapshot, size.height));
  }, [snapshot, size, owner]);

  // The canonical camera moved (an act just answered, or an asynchronous restore): ease the stage to it.
  const keepAnchor = useRef(false);
  const { cx, cy, scale } = snapshot.camera;
  useEffect(() => {
    if (size === null || placed.current !== owner.it || overviewRef.current === owner.key) return;
    canvas.current?.settleTo({ cx, cy, scale }, focusY, { keepAnchor: keepAnchor.current });
    keepAnchor.current = false;
  }, [cx, cy, scale, focusY, size, owner]);

  /** After an act: settle at once to whatever the authority now holds (also when the act moved nothing). */
  const settleNow = useCallback((aboutFingers = false) => {
    const at = owner.it.getSnapshot();
    const view = sizeRef.current;
    if (view === null) return;
    keepAnchor.current = aboutFingers;
    canvas.current?.settleTo(at.camera, focusYOf(at, view.height), { keepAnchor: aboutFingers });
  }, [owner]);

  // ── Overview: PRESENTATION ONLY (see the header). Nothing below this line writes a canonical camera. ─────────────
  const leaveOverview = useCallback(() => {
    if (overviewRef.current !== owner.key) return false;
    overviewRef.current = null;
    setOverviewKey(null);
    settleNow();
    return true;
  }, [owner, settleNow]);
  const enterOverview = useCallback(() => {
    const at = owner.it.getSnapshot();
    const view = sizeRef.current;
    const bounds = at.list.bounds;
    if (view === null || bounds === null || at.status !== 'READY') return;
    const margin = 110; // points kept free around the entities, for their light and their titles
    const fit = Math.min((view.width - margin) / Math.max(1, bounds.maxX - bounds.minX), (view.height - margin * 2.4) / Math.max(1, bounds.maxY - bounds.minY));
    const framed: NasijCamera = { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2, scale: Math.max(0.02, Math.min(at.camera.scale, fit)) };
    overviewRef.current = owner.key;
    setOverviewKey(owner.key);
    canvas.current?.settleTo(framed, view.height / 2);
  }, [owner]);

  const onViewSize = useCallback((width: number, height: number) => {
    sizeRef.current = { width, height };
    setSize((previous) => (previous !== null && previous.width === width && previous.height === height ? previous : { width, height }));
    owner.it.setView(width, height);
  }, [owner]);

  const onPanEnd = useCallback((released: NasijCamera) => {
    if (leaveOverview()) return;
    owner.it.pan(released);
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  // A pinch ends ABOUT THE FINGERS (PO finding, 2026-11-15: the scene drifted toward the screen centre after a pinch).
  // `released` is the magnified camera at release; the world point under the fingers is what must not move:
  //  - the pan part of the gesture is committed first, as the camera at the CURRENT rung's scale with that point still
  //    under the fingers (`zoomAbout`), so a sub-threshold or refused pinch eases back about the fingers, not the centre;
  //  - a step is then asked for with the fingers as its focal; the production step keeps its focal fixed, and because
  //    the pan was committed first that focal is exactly the fingers (no fallback to an approximate fixed point);
  //  - the settle keeps the anchor in every case. Nothing canonical is decided here: the authority may still refuse.
  const onPinchEnd = useCallback((direction: 'IN' | 'OUT' | null, fx: number, fy: number, released: NasijCamera) => {
    if (leaveOverview()) return;
    const size = sizeRef.current;
    const at = owner.it.getSnapshot();
    const view: NasijView | null = size === null ? null : { width: size.width, height: size.height, focusX: size.width / 2, focusY: focusYOf(at, size.height) };
    const atRung = view === null ? released : zoomAbout(released, view, fx, fy, at.camera.scale);
    owner.it.pan(atRung);
    if (direction === null) { settleNow(true); return; }
    const result = owner.it.step(direction, { x: fx, y: fy }, atRung);
    // A pinch that asked for a step the authority refused (a boundary, nothing to focus) is still a completed drag,
    // already committed above; it eases back to the rung about the fingers.
    settleNow(result.applied ? result.aboutFingers : true);
  }, [leaveOverview, owner, settleNow]);
  const lastTap = useRef(0);
  const onTap = useCallback((x: number, y: number, released: NasijCamera) => {
    if (leaveOverview()) return; // entity taps are disabled in the overview: the tap only returns
    const result = owner.it.tap(x, y, released);
    if (result === 'NONE') {
      const at = now();
      if (at - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; const stepped = owner.it.step('IN', { x, y }, released); settleNow(stepped.aboutFingers); return; }
      lastTap.current = at;
    } else lastTap.current = 0;
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  const onProbe = useCallback((result: ProbeResult) => {
    if (result.frames === 0) return;
    setLastProbe((previous) => ({ ...previous, [result.kind]: result }));
    setProbeLog((previous) => [...previous, { ...result, world }].slice(-24));
    // One line per gesture for `adb logcat -s ReactNativeJS` (synthetic fixture metrics only; nothing private).
    console.log(`[cosmos-proof] probe ${JSON.stringify({ world, ...result })}`);
  }, [world]);

  const stepBy = useCallback((direction: 'IN' | 'OUT') => { leaveOverview(); owner.it.step(direction, null, null); settleNow(); }, [leaveOverview, owner, settleNow]);
  const zoomIn = useCallback(() => stepBy('IN'), [stepBy]);
  const zoomOut = useCallback(() => stepBy('OUT'), [stepBy]);
  const activate = useCallback((id: string) => { if (leaveOverview()) return; owner.it.focus(id); settleNow(); }, [leaveOverview, owner, settleNow]);
  const labelOf = useCallback((id: string) => owner.it.labelOf(id), [owner]);
  const back = useCallback(() => {
    if (leaveOverview()) return;
    const at = owner.it.getSnapshot();
    if (!owner.it.back() && at.rung === 0) owner.it.goTo(0, 0);
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  const toRung = useCallback((rung: number) => {
    leaveOverview();
    let at = owner.it.getSnapshot().rung;
    while (at > rung) {
      const applied = owner.it.step('OUT', null, null).applied;
      const next = owner.it.getSnapshot().rung;
      if (!applied || next === at) break;
      at = next;
    }
    settleNow();
  }, [leaveOverview, owner, settleNow]);
  const switchWorld = useCallback((next: WorldKind) => { setWorld(next); setVisit((n) => n + 1); }, []);
  const reenter = useCallback(() => setVisit((n) => n + 1), []);
  const chooseFault = useCallback((next: CosmosFault) => { faultBox.set(next); setFault(next); setVisit((n) => n + 1); }, [faultBox]);

  // ── MEMORY: mount and unmount the world canvas N times, cycling worlds, then read the JS heap ───────────────────
  const cycling = useRef(false);
  const runCycle = useCallback(async (total: number) => {
    if (cycling.current) return;
    cycling.current = true;
    const before = readJsHeap(true);
    setCycle({ running: true, done: 0, total, before, after: null });
    for (let i = 0; i < total; i += 1) {
      setCanvasMounted(true);
      setWorld(WORLDS[i % WORLDS.length]);
      setVisit((n) => n + 1);
      // Until the world's first stage frame, or five seconds (a refused or empty world never draws one).
      await Promise.race([new Promise<void>((resolve) => { frameWaiter.current = resolve; }), sleep(5000)]);
      frameWaiter.current = null;
      await sleep(250);
      setCanvasMounted(false);
      await sleep(250);
      setCycle((previous) => ({ ...previous, done: i + 1 }));
    }
    setCanvasMounted(true);
    await sleep(400);
    const after = readJsHeap(true);
    setCycle({ running: false, done: total, total, before, after });
    console.log(`[cosmos-proof] cycle ${JSON.stringify({ total, before, after })}`);
    cycling.current = false;
  }, []);

  // ── deep links, so adb can drive the proof (scheme `qandeel-cosmos-proof://`) ────────────────────────────────────
  const follow = useCallback((link: ProofLink | null) => {
    if (link === null) return;
    if (link.kind === 'world') switchWorld(link.world);
    else if (link.kind === 'mode') setMode(link.mode);
    else if (link.kind === 'step') stepBy(link.direction);
    else if (link.kind === 'cycle') void runCycle(link.count);
    else if (link.kind === 'drift') setDrift(link.on);
    else if (link.kind === 'surface') setOpaqueSurface(link.opaque);
    else if (link.kind === 'lang') setLanguage(link.language);
    else if (link.kind === 'gc') collectRuntime(link.runtime);
    else if (link.kind === 'gcauto') uiCollectPerOpen.current = link.on;
  }, [runCycle, stepBy, switchWorld]);
  // ONE subscription for the life of the root, reading the LATEST handler through a ref. `follow` changes with every
  // owner (through `stepBy`), and an effect keyed on it re-ran on each new owner, read the launch URL again and
  // switched world again, so a process cold-started by a deep link never left "Reading…" (HONOR, 2026-11-15). The
  // launch URL is applied once per process; later `url` events are still delivered to the current handler.
  const followRef = useRef(follow);
  useEffect(() => { followRef.current = follow; }, [follow]);
  useEffect(() => {
    let live = true;
    void Linking.getInitialURL().then((url) => { if (live && url !== null) followRef.current(parseProofLink(url)); }).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => followRef.current(parseProofLink(event.url)));
    return () => { live = false; subscription.remove(); };
  }, []);

  const view: NasijView | null = size === null ? null : { width: size.width, height: size.height, focusX: size.width / 2, focusY };
  const absence: NasijAbsence = view === null ? { kind: 'LOADING' }
    : absenceOf({ status: snapshot.status, shown: snapshot.shown, worldIndex: snapshot.worldIndex }, snapshot.camera, view);
  const names = copy.rungs[snapshot.world];
  const atHome = !overview && snapshot.rung === 0 && snapshot.focusId === null && snapshot.camera.cx === 0 && snapshot.camera.cy === 0;
  const cardOpen = snapshot.card !== null;

  return (
    <View style={styles.root} testID={COSMOS_PROOF_ROOT_TEST_ID}>
      <StatusBar style="light" />
      {canvasMounted ? (
        <CosmosCanvas
          key={owner.key}
          ref={canvas}
          world={snapshot.world}
          stage={snapshot.list}
          held={snapshot.held}
          rung={snapshot.rung}
          rtl={rtl}
          initialCamera={snapshot.camera}
          mode={mode}
          drift={drift}
          opaqueSurface={opaqueSurface}
          onPanEnd={onPanEnd}
          onPinchEnd={onPinchEnd}
          onTap={onTap}
          onViewSize={onViewSize}
          onProbe={onProbe}
          onFirstStageFrame={onFirstStageFrame}
          accessibilityLabel={`${copy.sky} · ${copy[snapshot.world]} · ${names[snapshot.rung] ?? ''} · ${copy.fixture}`}
          zoomInLabel={copy.zoomIn}
          zoomOutLabel={copy.zoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          labelOf={labelOf}
          onActivate={activate}
        />
      ) : <View style={styles.root} />}

      {/* Top chrome: the worlds; Back, the persistent fixture label, language, Overview and the Measurements sheet. */}
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 6, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        <View accessibilityRole="tablist" style={[styles.tabs, rtl && styles.rowReverse]}>
          {WORLDS.map((w) => (
            <Pressable key={w} accessibilityRole="tab" accessibilityState={{ selected: w === world }} onPress={() => switchWorld(w)} style={styles.tab}>
              <Text style={[styles.tabText, rtl && styles.tabTextArabic, { color: w === world ? C.gold : C.quiet }]}>{rtl ? copy[w] : copy[w].toUpperCase()}</Text>
              <View style={[styles.tabMark, { opacity: w === world ? 1 : 0 }]} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.row, rtl && styles.rowReverse]}>
          <Pressable accessibilityRole="button" disabled={atHome} onPress={back} style={[styles.pill, { opacity: atHome ? 0 : 1 }]}>
            <Text style={styles.pillText}>{overview ? copy.back : snapshot.rung > 0 ? `${rtl ? '→' : '←'} ${names[snapshot.rung - 1]}` : snapshot.focusId !== null ? copy.back : copy.overview}</Text>
          </Pressable>
          <View style={styles.spacer} />
          <Chip label={copy.overviewAct} selected={overview} onPress={() => { if (!leaveOverview()) enterOverview(); }} />
          <Chip label={language === 'ar' ? 'EN' : 'ع'} accessibilityLabel={language === 'ar' ? 'English' : 'العربية'} onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')} />
          <Chip label="⚙" accessibilityLabel={copy.measurements} selected={sheet} onPress={() => setSheet((v) => !v)} />
        </View>

        <Text testID={COSMOS_FIXTURE_LABEL_TEST_ID} accessibilityRole="text" style={[styles.fixture, { textAlign: rtl ? 'left' : 'right' }]}>
          {rtl ? copy.fixture : copy.fixture.toUpperCase()}
        </Text>
        {overview ? <Text testID={COSMOS_OVERVIEW_TAG_TEST_ID} accessibilityLiveRegion="polite" style={styles.overviewTag}>{copy.overviewTag}</Text> : null}

        <Hud last={lastProbe} mode={mode} stage={snapshot} />
      </View>

      {/* The depth rail: the current depth is the lit point; a shallower depth can be returned to. */}
      <View pointerEvents="box-none" style={[styles.rail, rtl ? { left: insets.left + 2 } : { right: insets.right + 2 }]}>
        <View style={[styles.railLine, rtl ? { left: 21.5 } : { right: 21.5 }]} />
        {names.map((name, i) => {
          const on = i === snapshot.rung;
          const past = i < snapshot.rung;
          return (
            <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: on, disabled: !past }} disabled={!past}
              onPress={() => toRung(i)} style={[styles.bead, rtl && styles.rowReverse]}>
              {on ? <Text style={[styles.beadText, rtl && styles.beadTextArabic]}>{rtl ? name : name.toUpperCase()}</Text> : null}
              <View style={styles.beadSlot}>
                <View style={on ? styles.beadOn : [styles.beadDot, past && { backgroundColor: C.goldDim }]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <AbsenceNote absence={absence} copy={copy} onRetry={reenter} onNearest={(x, y) => { leaveOverview(); owner.it.goTo(x, y); settleNow(); }} camera={snapshot.camera} />

      {/* Personal: the positions of the session (time) and the unplaced count. Hidden while the card is open. */}
      {snapshot.time === null || cardOpen ? null : (
        <PositionTicks time={snapshot.time} copy={copy} rtl={rtl} bottom={insets.bottom + 12}
          onMoment={(sp) => { leaveOverview(); owner.it.commitMoment?.(sp); }} onLive={() => { leaveOverview(); owner.it.goLive?.(); }} />
      )}

      {/* The card: a fixed peek height from its first frame, whatever its read does. */}
      {snapshot.card === null ? null : (
        <Card card={snapshot.card} copy={copy} rtl={rtl} bottomInset={insets.bottom} onClose={back}
          onRetry={() => { if (snapshot.focusId !== null) activate(snapshot.focusId); }} />
      )}

      {sheet ? (
        <MeasurementsSheet
          copy={copy} top={insets.top + 96} bottomInset={insets.bottom} mode={mode} onMode={setMode} drift={drift} onDrift={setDrift}
          opaqueSurface={opaqueSurface} onSurface={setOpaqueSurface} fault={fault} onFault={chooseFault}
          opens={opens} probes={probeLog} cycle={cycle} onCycle={() => { void runCycle(20); }} onClose={() => setSheet(false)}
          drawOps={drawOpsAtRest(snapshot.list, snapshot.rung)} entities={snapshot.entityCount}
        />
      ) : null}
    </View>
  );
}

function Chip({ label, onPress, selected = false, accessibilityLabel, disabled = false }: { label: string; onPress: () => void; selected?: boolean; accessibilityLabel?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} hitSlop={4}
      style={[styles.chip, selected && { borderColor: C.gold }, disabled && { opacity: 0.4 }]}>
      <Text style={[styles.pillText, selected && { color: C.gold }]}>{label}</Text>
    </Pressable>
  );
}

const ms = (v: number): string => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
/** One probe result as one line. Named for what it is: UI-thread frame-callback intervals. */
function probeLine(p: ProbeResult): string {
  return `${p.kind.padEnd(4)} ${MODE_LABEL[p.mode]}${p.drift ? '' : ' no-drift'} · ${p.avgFps.toFixed(1)} fps · p50 ${ms(p.p50)} · p95 ${ms(p.p95)} · max ${ms(p.max)} ms · ${p.frames} f`
    + ` · stalls ${p.stalls} · freezes ${p.freezes}${p.inputs > 0 ? ` · event→frame p50 ${ms(p.inputP50)} / p95 ${ms(p.inputP95)} ms (${p.inputs})` : ''}`;
}

/** The HUD: the last PAN and the last ZOOM, each with the mode it was measured in. */
function Hud({ last, mode, stage }: { last: Partial<Record<MotionKind, ProbeResult>>; mode: OverdrawMode; stage: CosmosWorldSnapshot }) {
  const line = (kind: MotionKind) => { const p = last[kind]; return p === undefined ? `${kind.padEnd(4)} —` : probeLine(p); };
  return (
    <Text testID={COSMOS_HUD_TEST_ID} accessible={false} importantForAccessibility="no" style={styles.hud}>
      {`mode ${MODE_LABEL[mode]}${mode === 'FULL' ? '' : ' (MEASUREMENT ONLY)'} · ${stage.entityCount} entities · ${drawOpsAtRest(stage.list, stage.rung)} draw ops\n${line('PAN')}\n${line('ZOOM')}\nUI-thread frame-callback intervals (not presented frames)`}
    </Text>
  );
}

/** The five absences, never one sentence. */
function AbsenceNote({ absence, copy, onRetry, onNearest, camera }: {
  absence: NasijAbsence; copy: CosmosCopy; onRetry: () => void; onNearest: (x: number, y: number) => void; camera: NasijCamera;
}) {
  if (absence.kind === 'NONE') return null;
  const words = absence.kind === 'LOADING' ? copy.loading : absence.kind === 'UNAVAILABLE' ? copy.unavailable : absence.kind === 'REFUSED' ? copy.refused
    : absence.kind === 'WORLD_EMPTY' ? copy.worldEmpty : copy.regionEmpty;
  const bearing = absence.kind === 'REGION_EMPTY' ? absence.bearing : null;
  return (
    <View pointerEvents="box-none" style={styles.absenceWrap}>
      <View accessibilityLiveRegion="polite" testID={`cosmos-absence-${absence.kind}`} style={styles.absence}>
        <Text style={styles.absenceText}>{words}</Text>
        {absence.kind === 'UNAVAILABLE' ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.absenceAct}><Text style={styles.goldText}>{copy.retry}</Text></Pressable>
        ) : null}
        {bearing === null ? null : (
          <Pressable accessibilityRole="button" onPress={() => onNearest(camera.cx + bearing.dx, camera.cy + bearing.dy)} style={styles.absenceAct}>
            <Text style={[styles.goldText, { transform: [{ rotate: `${Math.atan2(bearing.dy, bearing.dx)}rad` }] }]}>➤</Text>
            <Text style={styles.goldText}>{copy.nearest}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PositionTicks({ time, copy, rtl, bottom, onMoment, onLive }: {
  time: CosmosTime; copy: CosmosCopy; rtl: boolean; bottom: number; onMoment: (sp: number) => void; onLive: () => void;
}) {
  return (
    <View style={[styles.ticksWrap, { bottom }]}>
      <View style={[styles.ticks, rtl && styles.rowReverse]}>
        {Array.from({ length: time.liveHead }, (_unused, i) => {
          const sp = i + 1;
          const at = sp === time.tc;
          return (
            <Pressable key={sp} accessibilityRole="button" accessibilityLabel={copy.position(sp, time.liveHead)} accessibilityState={{ selected: at }}
              onPress={() => onMoment(sp)} style={styles.tick}>
              <View style={at ? styles.tickAt : [styles.tickBar, sp <= time.tc && styles.tickLit]} />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.row, rtl && styles.rowReverse]}>
        <Text style={styles.quietText}>{time.pinned ? copy.position(time.tc, time.liveHead) : copy.live}</Text>
        {time.fringe > 0 ? <Text style={styles.quietText}>{`◌ ${copy.fringe(time.fringe)}`}</Text> : null}
        <View style={styles.spacer} />
        {time.pinned ? <Pressable accessibilityRole="button" onPress={onLive} style={styles.liveAct}><Text style={styles.goldText}>{copy.live}</Text></Pressable> : null}
      </View>
    </View>
  );
}

function Card({ card, copy, rtl, bottomInset, onClose, onRetry }: {
  card: CosmosCard; copy: CosmosCopy; rtl: boolean; bottomInset: number; onClose: () => void; onRetry: () => void;
}) {
  const align = { textAlign: rtl ? 'right' : 'left' } as const;
  return (
    <View accessibilityViewIsModal={false} style={[styles.card, { height: CARD_PEEK - 6, bottom: Math.max(10, Math.min(bottomInset, 16)) }]}>
      <View style={styles.cardRule} />
      <View style={[styles.row, rtl && styles.rowReverse, styles.cardHead]}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.cardTitle, align]}>{card.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} hitSlop={8} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.cardBody} accessibilityState={{ busy: card.status === 'LOADING' }}>
        {card.status === 'LOADING' ? (
          <>
            <View style={styles.skeleton} />
            <View style={[styles.skeleton, styles.skeletonShort]} />
            <View style={styles.skeleton} />
          </>
        ) : card.status === 'UNAVAILABLE' ? (
          <>
            <Text style={[styles.cardMeta, align]}>{copy.unavailable}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.liveAct}><Text style={styles.goldText}>{copy.retry}</Text></Pressable>
          </>
        ) : card.status === 'ABSENT' ? (
          <Text style={[styles.cardMeta, align]}>{copy.absent}</Text>
        ) : (
          <>
            {card.meta.length > 0 ? <Text style={[styles.cardMeta, align]}>{card.meta}</Text> : null}
            {card.lines.map((line, i) => <Text key={i} style={[styles.cardLine, align]}>{line}</Text>)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const heapLine = (r: JsHeapReading | null): string => (r === null ? '—' : r.usedBytes === null ? `not available (${r.source})` : `${(r.usedBytes / 1048576).toFixed(2)} MB used (${r.source}${r.collected ? ', after gc()' : ', gc() not exposed'})`);

/** The Measurements sheet. English only: an engineering instrument, not Product copy. */
function MeasurementsSheet({ copy, top, bottomInset, mode, onMode, drift, onDrift, opaqueSurface, onSurface, fault, onFault, opens, probes, cycle, onCycle, onClose, drawOps, entities }: {
  copy: CosmosCopy; top: number; bottomInset: number; mode: OverdrawMode; onMode: (m: OverdrawMode) => void; drift: boolean; onDrift: (on: boolean) => void;
  opaqueSurface: boolean; onSurface: (opaque: boolean) => void; fault: CosmosFault; onFault: (f: CosmosFault) => void;
  opens: readonly OpenRecord[]; probes: readonly (ProbeResult & { readonly world: WorldKind })[]; cycle: CycleState; onCycle: () => void; onClose: () => void;
  drawOps: number; entities: number;
}) {
  return (
    <View style={[styles.sheet, { top, paddingBottom: bottomInset + 8 }]} testID="cosmos-measurements">
      <View style={styles.row}>
        <Text style={styles.sheetTitle}>{copy.measurements}</Text>
        <View style={styles.spacer} />
        <Chip label="×" accessibilityLabel={copy.close} onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <Text style={styles.sheetHead}>OVERDRAW MODE — MEASUREMENT ONLY (default FULL = the look)</Text>
        <View style={styles.wrap}>
          {OVERDRAW_MODES.map((m) => <Chip key={m} label={MODE_LABEL[m]} selected={m === mode} onPress={() => onMode(m)} />)}
        </View>
        <Text style={styles.sheetNote}>
          NO_BODIES and PLATES_ONLY are diagnostics, not looks: NO_BODIES hides only the three FIBRE plates and PUFF (nodes, halos, strands and plates stay); PLATES_ONLY draws the atmosphere alone. Compare their frame times with FULL to see what the nebula bodies cost.
        </Text>
        <View style={styles.wrap}>
          <Chip label={`Drift ${drift ? 'on' : 'off'}`} selected={drift} onPress={() => onDrift(!drift)} />
          <Chip label={opaqueSurface ? 'SurfaceView' : 'TextureView'} selected={opaqueSurface} onPress={() => onSurface(!opaqueSurface)} />
        </View>
        <Text style={styles.sheetNote}>{`${entities} entities · ${drawOps} draw ops at rest (atlas + hairline sets + horizon), plus 3 plate fills and the lens.`}</Text>

        <Text style={styles.sheetHead}>{copy.faultTitle.toUpperCase()}</Text>
        <View style={styles.wrap}>
          {COSMOS_FAULTS.map((f) => <Chip key={f} label={copy.faults[f]} selected={f === fault} onPress={() => onFault(f)} />)}
        </View>

        <Text style={styles.sheetHead}>OPEN TIMES (ms from the switch)</Text>
        <Text style={styles.mono}>{'#   world     start  READY   first stage frame'}</Text>
        {opens.length === 0 ? <Text style={styles.mono}>—</Text> : opens.map((o) => (
          <Text key={o.n} style={styles.mono}>{`${String(o.n).padEnd(3)} ${o.world.padEnd(9)} ${(o.cold ? 'COLD' : 'WARM').padEnd(6)} ${String(o.readyMs ?? '—').padEnd(7)} ${o.frameMs ?? '—'}`}</Text>
        ))}
        <Text style={styles.sheetNote}>COLD is the first open after the process started (the assets decode). &quot;First stage frame&quot; is the first UI frame after a non-empty stage and its images were committed to the canvas: a proxy, not a presented-frame time.</Text>

        <Text style={styles.sheetHead}>FRAME PROBE (per gesture + settle, newest last)</Text>
        {probes.length === 0 ? <Text style={styles.mono}>move the world to measure</Text> : probes.map((p, i) => <Text key={i} style={styles.mono}>{`${p.world.slice(0, 3)} ${probeLine(p)}`}</Text>)}
        <Text style={styles.sheetNote}>
          These are UI-thread frame-callback intervals, not display-presented frame times; a stall is an interval over 50 ms, a freeze over 100 ms. &quot;event→frame&quot; is the time from a gesture event to the next UI frame callback on one clock. It is NOT touch-to-photon latency: that needs external capture (SurfaceFlinger present times with experiments/cosmos-proof/measure-honor.sh, or a high-speed camera).
        </Text>

        <Text style={styles.sheetHead}>MEMORY</Text>
        <View style={styles.wrap}>
          <Chip label={cycle.running ? `Cycling ${cycle.done}/${cycle.total}…` : 'Open/close ×20'} disabled={cycle.running} onPress={onCycle} />
        </View>
        <Text style={styles.mono}>{`JS heap before: ${heapLine(cycle.before)}\nJS heap after:  ${heapLine(cycle.after)}`}</Text>
        <Text style={styles.sheetNote}>The JS heap says nothing about native or graphics memory, where images, paths and textures live. Read those with adb: `dumpsys meminfo &lt;package&gt;` (Native Heap, Graphics) before and after the cycle.</Text>
      </ScrollView>
    </View>
  );
}

export type { CosmosWorldSnapshot };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowReverse: { flexDirection: 'row-reverse' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spacer: { flex: 1 },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tab: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, letterSpacing: 2.4 },
  tabTextArabic: { fontSize: 15, letterSpacing: 0 },
  tabMark: { position: 'absolute', bottom: 6, width: 5, height: 5, backgroundColor: C.gold, transform: [{ rotate: '45deg' }] },
  pill: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, color: C.ink },
  chip: { minHeight: 40, minWidth: 44, paddingHorizontal: 12, borderRadius: 20, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  fixture: { fontSize: 10, letterSpacing: 1.2, color: 'rgba(154, 157, 180, 0.9)' },
  overviewTag: { alignSelf: 'center', fontSize: 11, letterSpacing: 0.6, color: C.gold, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.goldDim, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  hud: { alignSelf: 'flex-start', maxWidth: '86%', fontSize: 9.5, lineHeight: 13, fontFamily: 'monospace', color: C.ink, backgroundColor: 'rgba(11, 13, 26, 0.78)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden' },
  rail: { position: 'absolute', top: '36%' },
  railLine: { position: 'absolute', top: 22, bottom: 22, width: 1, backgroundColor: C.goldDim },
  bead: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  beadSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  beadDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.void, borderWidth: 1, borderColor: C.goldDim },
  beadOn: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.gold, borderWidth: 4, borderColor: 'rgba(236, 204, 138, 0.3)' },
  beadText: { fontSize: 10, letterSpacing: 1.8, color: C.gold, textShadowColor: C.void, textShadowRadius: 8 },
  beadTextArabic: { fontSize: 13, letterSpacing: 0 },
  absenceWrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  absence: { maxWidth: '76%', alignItems: 'center', backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  absenceText: { fontSize: 16, lineHeight: 24, color: C.ink, textAlign: 'center' },
  absenceAct: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  goldText: { fontSize: 13, color: C.gold },
  quietText: { fontSize: 11, letterSpacing: 0.8, color: C.quiet },
  ticksWrap: { position: 'absolute', left: 18, right: 18, gap: 2 },
  ticks: { flexDirection: 'row', height: 44 },
  tick: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  tickBar: { width: 1, height: 9, backgroundColor: C.hair },
  tickLit: { height: 13, backgroundColor: C.goldDim },
  tickAt: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold },
  liveAct: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  card: { position: 'absolute', left: 10, right: 10, backgroundColor: C.solid, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderRadius: 20, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, overflow: 'hidden' },
  cardRule: { position: 'absolute', left: 22, right: 22, top: 0, height: StyleSheet.hairlineWidth, backgroundColor: C.gold, opacity: 0.7 },
  cardHead: { alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '700', color: C.title },
  close: { minWidth: 44, minHeight: 44, marginTop: -10, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, lineHeight: 24, color: C.quiet },
  cardBody: { flex: 1 },
  cardMeta: { fontSize: 11.5, letterSpacing: 0.4, color: C.quiet, marginBottom: 4 },
  cardLine: { fontSize: 14, lineHeight: 21, color: C.ink, marginBottom: 4 },
  skeleton: { height: 10, borderRadius: 6, marginTop: 11, backgroundColor: C.hair },
  skeletonShort: { width: '58%' },
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 0, backgroundColor: 'rgba(11, 13, 26, 0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 12, paddingTop: 8 },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: C.title },
  sheetBody: { gap: 6, paddingBottom: 16 },
  sheetHead: { fontSize: 10.5, letterSpacing: 1.4, color: C.gold, marginTop: 8 },
  sheetNote: { fontSize: 11, lineHeight: 16, color: C.quiet },
  mono: { fontSize: 10, lineHeight: 15, fontFamily: 'monospace', color: C.ink },
});
