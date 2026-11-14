// NASIJ proof (experimental, isolated) — the proof root. VALIDATION ONLY.
//
// One full-screen cloth and, over it, the proof's chrome: the three worlds, Arabic / English, the night cloth, the
// depth rail, Back, the five absence states, the lantern card, the Personal selvedge (time) and fringe (unplaced), a
// fault selector for the fixture network and a HUD line of measured frame pacing.
//
// EVERYTHING SHOWN IS A LABELLED SYNTHETIC FIXTURE, and the screen says so at all times. The authority is production:
// each world's owner (`./owners`) drives the shipped controller and this root only relays what the fingers did and
// eases the cloth to the camera the authority answered with.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deviceProductLanguage } from '../../integration/locale/device-locale';
import { absenceOf, type NasijAbsence } from '../core/absence';
import type { NasijCamera, NasijView } from '../core/camera';
import { DAY_CLOTH, NIGHT_CLOTH, type NasijPalette } from '../core/palette';
import { drawOpsAtRest, type NasijWorldKind } from '../core/scene';
import { NasijCanvas, type NasijCanvasHandle, type NasijFrameStats } from '../skia/NasijCanvas';
import { NASIJ_COPY, type NasijCopy, type NasijLanguage } from './copy';
import { NASIJ_FAULTS, type NasijFault } from './fixture-transports';
import { CARD_PEEK, createNasijOwner, focusYOf, type NasijCard, type NasijTime, type NasijWorldOwner, type NasijWorldSnapshot } from './owners';

const WORLDS: readonly NasijWorldKind[] = ['PERSONAL', 'SHARED', 'PUBLIC'];
const DOUBLE_TAP_MS = 320;
const now = (): number => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

export const NASIJ_PROOF_ROOT_TEST_ID = 'nasij-proof-root';
export const NASIJ_FIXTURE_LABEL_TEST_ID = 'nasij-fixture-label';

export function NasijProofRoot() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NasijProof />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function NasijProof() {
  const insets = useSafeAreaInsets();
  const [world, setWorld] = useState<NasijWorldKind>('PUBLIC');
  const [language, setLanguage] = useState<NasijLanguage>(deviceProductLanguage);
  const [night, setNight] = useState(false);
  const [fault, setFault] = useState<NasijFault>('NONE');
  const [visit, setVisit] = useState(0);
  const [lab, setLab] = useState(false);
  const copy = NASIJ_COPY[language];
  const palette = night ? NIGHT_CLOTH : DAY_CLOTH;
  const rtl = language === 'ar';

  // One owner per (world, language, visit): entering a world inherits nothing from an earlier visit.
  const [faultBox] = useState(() => { let current: NasijFault = 'NONE'; return { get: () => current, set: (next: NasijFault) => { current = next; } }; });
  const [owner, setOwner] = useState(() => ({ key: `${world}:${language}:${visit}`, made: now(), it: createNasijOwner(world, { language, fault: faultBox.get }) }));
  const ownerKey = `${world}:${language}:${visit}`;
  if (owner.key !== ownerKey) setOwner({ key: ownerKey, made: now(), it: createNasijOwner(world, { language, fault: faultBox.get }) });
  const snapshot = useSyncExternalStore(owner.it.subscribe, owner.it.getSnapshot);
  const canvas = useRef<NasijCanvasHandle>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const sizeRef = useRef(size);
  const [stats, setStats] = useState<NasijFrameStats | null>(null);
  const [opened, setOpened] = useState<Partial<Record<NasijWorldKind, number>>>({});

  useEffect(() => {
    const it = owner.it;
    if (sizeRef.current !== null) it.setView(sizeRef.current.width, sizeRef.current.height);
    it.enter();
    return () => it.dispose();
  }, [owner]);

  const focusY = size === null ? 0 : focusYOf(snapshot, size.height);

  // Cold open: from the owner's creation to the first animation frame after the commit that mounted its READY cloth.
  // (A JS-side proxy for "first draw": Skia paints that tree on the frame this callback runs in.)
  const measured = useRef<NasijWorldOwner | null>(null);
  useEffect(() => {
    if (snapshot.status !== 'READY' || size === null || measured.current === owner.it) return undefined;
    measured.current = owner.it;
    // A new world's first READY cloth: the camera is placed, not animated.
    canvas.current?.jumpTo(snapshot.camera, focusYOf(snapshot, size.height));
    const frame = requestAnimationFrame(() => setOpened((previous) => ({ ...previous, [snapshot.world]: Math.round(now() - owner.made) })));
    return () => cancelAnimationFrame(frame);
  }, [snapshot, size, owner]);

  // The canonical camera moved (an act just answered, or an asynchronous restore): ease the cloth to it.
  const keepAnchor = useRef(false);
  const { cx, cy, scale } = snapshot.camera;
  useEffect(() => {
    if (size === null || measured.current !== owner.it) return;
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

  const onViewSize = useCallback((width: number, height: number) => {
    sizeRef.current = { width, height };
    setSize((previous) => (previous !== null && previous.width === width && previous.height === height ? previous : { width, height }));
    owner.it.setView(width, height);
  }, [owner]);

  const onPanEnd = useCallback((released: NasijCamera) => { owner.it.pan(released); settleNow(); }, [owner, settleNow]);
  const onPinchEnd = useCallback((direction: 'IN' | 'OUT' | null, fx: number, fy: number, released: NasijCamera) => {
    if (direction === null) { owner.it.pan(released); settleNow(); return; }
    const result = owner.it.step(direction, { x: fx, y: fy }, released);
    // A pinch that asked for a step the authority refused (a boundary, nothing to focus) is still a completed drag.
    if (!result.applied) owner.it.pan(released);
    settleNow(result.aboutFingers);
  }, [owner, settleNow]);
  const lastTap = useRef(0);
  const onTap = useCallback((x: number, y: number, released: NasijCamera) => {
    const result = owner.it.tap(x, y, released);
    if (result === 'NONE') {
      const at = now();
      if (at - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; const stepped = owner.it.step('IN', { x, y }, released); settleNow(stepped.aboutFingers); return; }
      lastTap.current = at;
    } else lastTap.current = 0;
    settleNow();
  }, [owner, settleNow]);
  const onSettled = useCallback(() => { setStats(canvas.current?.readFrameStats() ?? null); }, []);

  const stepBy = useCallback((direction: 'IN' | 'OUT') => { owner.it.step(direction, null, null); settleNow(); }, [owner, settleNow]);
  const zoomIn = useCallback(() => stepBy('IN'), [stepBy]);
  const zoomOut = useCallback(() => stepBy('OUT'), [stepBy]);
  const activate = useCallback((id: string) => { owner.it.focus(id); settleNow(); }, [owner, settleNow]);
  const labelOf = useCallback((id: string) => owner.it.labelOf(id), [owner]);
  const back = useCallback(() => {
    const at = owner.it.getSnapshot();
    if (!owner.it.back() && at.rung === 0) owner.it.goTo(0, 0);
    settleNow();
  }, [owner, settleNow]);
  const toRung = useCallback((rung: number) => {
    let at = owner.it.getSnapshot().rung;
    while (at !== rung) {
      const applied = owner.it.step(rung > at ? 'IN' : 'OUT', null, null).applied;
      const next = owner.it.getSnapshot().rung;
      if (!applied || next === at) break;
      at = next;
    }
    settleNow();
  }, [owner, settleNow]);
  const reenter = useCallback(() => setVisit((n) => n + 1), []);
  const chooseFault = useCallback((next: NasijFault) => {
    faultBox.set(next);
    setFault(next);
    if (next === 'DENSE') setWorld('PUBLIC');
    setVisit((n) => n + 1);
  }, [faultBox]);

  const view: NasijView | null = size === null ? null : { width: size.width, height: size.height, focusX: size.width / 2, focusY };
  const absence: NasijAbsence = view === null ? { kind: 'LOADING' }
    : absenceOf({ status: snapshot.status, shown: snapshot.shown, worldIndex: snapshot.worldIndex }, snapshot.camera, view);
  const names = copy.rungs[snapshot.world];
  const atHome = snapshot.rung === 0 && snapshot.focusId === null && snapshot.camera.cx === 0 && snapshot.camera.cy === 0;
  const hud = `${stats === null || stats.count === 0 ? 'frame —' : `frame p50 ${stats.p50.toFixed(1)} · p95 ${stats.p95.toFixed(1)} · max ${stats.max.toFixed(1)} ms · ${stats.fps.toFixed(0)} fps (${stats.count}f)`}`
    + ` · ${drawOpsAtRest(snapshot.list, snapshot.rung)} draw ops · ${snapshot.entityCount} entities`
    + `\nopen ${WORLDS.map((w) => `${w.slice(0, 3)} ${opened[w] === undefined ? '—' : `${opened[w]} ms`}`).join(' · ')}`;

  return (
    <View style={[styles.root, { backgroundColor: palette.colors.ground }]} testID={NASIJ_PROOF_ROOT_TEST_ID}>
      <StatusBar style={night ? 'light' : 'dark'} />
      <NasijCanvas
        key={owner.key}
        ref={canvas}
        list={snapshot.list}
        held={snapshot.held}
        rung={snapshot.rung}
        palette={palette}
        night={night}
        rtl={rtl}
        initialCamera={snapshot.camera}
        onPanEnd={onPanEnd}
        onPinchEnd={onPinchEnd}
        onTap={onTap}
        onSettled={onSettled}
        onViewSize={onViewSize}
        accessibilityLabel={`${copy.cloth} · ${copy[snapshot.world]} · ${names[snapshot.rung] ?? ''} · ${copy.fixture}`}
        zoomInLabel={copy.zoomIn}
        zoomOutLabel={copy.zoomOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        labelOf={labelOf}
        onActivate={activate}
      />

      {/* Top chrome: worlds, language, night; the persistent fixture label; the depth rail and Back. */}
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 6, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
        <View style={[styles.row, rtl && styles.rowReverse]}>
          <View accessibilityRole="tablist" style={[styles.pill, { backgroundColor: palette.card, borderColor: palette.colors.undyed }, rtl && styles.rowReverse]}>
            {WORLDS.map((w) => (
              <Pressable key={w} accessibilityRole="tab" accessibilityState={{ selected: w === world }} onPress={() => { setWorld(w); setVisit((n) => n + 1); }}
                style={[styles.tab, w === world && { backgroundColor: palette.colors.ink }]}>
                <Text style={[styles.tabText, { color: w === world ? palette.colors.ground : palette.text }]}>{copy[w]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.spacer} />
          <Chip palette={palette} label={language === 'ar' ? 'EN' : 'ع'} accessibilityLabel={language === 'ar' ? 'English' : 'العربية'} onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')} />
          <Chip palette={palette} label={night ? '☀' : '☾'} accessibilityLabel={copy.night} selected={night} onPress={() => setNight((v) => !v)} />
          <Chip palette={palette} label="⚙" accessibilityLabel={copy.faultTitle} selected={lab} onPress={() => setLab((v) => !v)} />
        </View>

        <Text testID={NASIJ_FIXTURE_LABEL_TEST_ID} accessibilityRole="text" style={[styles.fixture, { color: palette.colors.ground, backgroundColor: palette.colors.accent }]}>
          {copy.fixture.toUpperCase()}
        </Text>

        <View style={[styles.row, rtl && styles.rowReverse]}>
          <Pressable accessibilityRole="button" disabled={atHome} onPress={back}
            style={[styles.pill, styles.back, { backgroundColor: palette.card, borderColor: palette.colors.undyed, opacity: atHome ? 0.45 : 1 }]}>
            <Text style={[styles.tabText, { color: palette.text }]}>{snapshot.rung > 0 ? `${rtl ? '→' : '←'} ${names[snapshot.rung - 1]}` : snapshot.focusId !== null ? copy.back : copy.overview}</Text>
          </Pressable>
          <View style={styles.spacer} />
          <View style={[styles.pill, { backgroundColor: palette.card, borderColor: palette.colors.undyed }, rtl && styles.rowReverse]}>
            {names.map((name, i) => {
              const on = i === snapshot.rung;
              const reachable = i < snapshot.rung || i === snapshot.rung + 1;
              return (
                <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !reachable }} disabled={!reachable}
                  onPress={() => toRung(i)} style={styles.bead}>
                  <View style={[styles.beadDot, { borderColor: palette.colors.ink, backgroundColor: on ? palette.colors.accent : i < snapshot.rung ? palette.colors.ink : 'transparent' }]} />
                  <Text style={[styles.beadText, { color: on ? palette.text : palette.textQuiet, fontWeight: on ? '700' : '400' }]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {lab ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lab} contentContainerStyle={styles.labRow}>
            {NASIJ_FAULTS.map((f) => (
              <Chip key={f} palette={palette} label={copy.faults[f]} selected={f === fault} onPress={() => chooseFault(f)} />
            ))}
          </ScrollView>
        ) : null}

        <Text style={[styles.hud, { color: palette.textQuiet, backgroundColor: palette.card }]}>{hud}</Text>

        <AbsenceNote absence={absence} copy={copy} palette={palette} onRetry={reenter}
          onNearest={(x, y) => { owner.it.goTo(x, y); settleNow(); }} camera={snapshot.camera} />
      </View>

      {/* Personal: the selvedge (time) and the fringe (unplaced). */}
      {snapshot.time === null ? null : (
        <Selvedge time={snapshot.time} copy={copy} palette={palette} rtl={rtl} bottom={(snapshot.card !== null ? CARD_PEEK : 0) + insets.bottom + 10}
          onMoment={(sp) => owner.it.commitMoment?.(sp)} onLive={() => owner.it.goLive?.()} />
      )}

      {/* The lantern card: a fixed peek height from its first frame, whatever its read does. */}
      {snapshot.card === null ? null : <Card card={snapshot.card} copy={copy} palette={palette} rtl={rtl} bottomInset={insets.bottom} onClose={back} onRetry={() => { if (snapshot.focusId !== null) activate(snapshot.focusId); }} />}
    </View>
  );
}

function Chip({ palette, label, onPress, selected = false, accessibilityLabel }: { palette: NasijPalette; label: string; onPress: () => void; selected?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }} onPress={onPress} hitSlop={6}
      style={[styles.chip, { backgroundColor: selected ? palette.colors.ink : palette.card, borderColor: palette.colors.undyed }]}>
      <Text style={[styles.tabText, { color: selected ? palette.colors.ground : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

/** The five absences, never one sentence. */
function AbsenceNote({ absence, copy, palette, onRetry, onNearest, camera }: {
  absence: NasijAbsence; copy: NasijCopy; palette: NasijPalette; onRetry: () => void; onNearest: (x: number, y: number) => void; camera: NasijCamera;
}) {
  if (absence.kind === 'NONE') return null;
  const words = absence.kind === 'LOADING' ? copy.loading : absence.kind === 'UNAVAILABLE' ? copy.unavailable : absence.kind === 'REFUSED' ? copy.refused
    : absence.kind === 'WORLD_EMPTY' ? copy.worldEmpty : copy.regionEmpty;
  const bearing = absence.kind === 'REGION_EMPTY' ? absence.bearing : null;
  return (
    <View accessibilityLiveRegion="polite" testID={`nasij-absence-${absence.kind}`} style={[styles.absence, { backgroundColor: palette.card, borderColor: palette.colors.undyed }]}>
      <Text style={[styles.absenceText, { color: palette.text }]}>{words}</Text>
      {absence.kind === 'UNAVAILABLE' ? <Chip palette={palette} label={copy.retry} onPress={onRetry} /> : null}
      {bearing === null ? null : (
        <Pressable accessibilityRole="button" onPress={() => onNearest(camera.cx + bearing.dx, camera.cy + bearing.dy)}
          style={[styles.chip, styles.nearest, { backgroundColor: palette.colors.ink, borderColor: palette.colors.ink }]}>
          <Text style={[styles.arrow, { color: palette.colors.ground, transform: [{ rotate: `${Math.atan2(bearing.dy, bearing.dx)}rad` }] }]}>➤</Text>
          <Text style={[styles.tabText, { color: palette.colors.ground }]}>{copy.nearest}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Selvedge({ time, copy, palette, rtl, bottom, onMoment, onLive }: {
  time: NasijTime; copy: NasijCopy; palette: NasijPalette; rtl: boolean; bottom: number; onMoment: (sp: number) => void; onLive: () => void;
}) {
  return (
    <View style={[styles.selvedge, { bottom, backgroundColor: palette.card, borderColor: palette.colors.undyed }]}>
      <View style={[styles.ticks, rtl && styles.rowReverse]}>
        {Array.from({ length: time.liveHead }, (_unused, i) => {
          const sp = i + 1;
          return (
            <Pressable key={sp} accessibilityRole="button" accessibilityLabel={copy.position(sp, time.liveHead)} accessibilityState={{ selected: sp === time.tc }}
              onPress={() => onMoment(sp)} hitSlop={{ top: 14, bottom: 14, left: 2, right: 2 }} style={styles.tick}>
              <View style={[styles.tickBar, { height: sp === time.tc ? 22 : 12, backgroundColor: sp === time.tc ? palette.colors.accent : sp <= time.tc ? palette.colors.ink : palette.colors.undyed }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.row, rtl && styles.rowReverse]}>
        <Text style={[styles.beadText, { color: palette.text }]}>{time.pinned ? copy.position(time.tc, time.liveHead) : copy.live}</Text>
        {time.fringe > 0 ? <Text style={[styles.beadText, { color: palette.textQuiet }]}>{`  ·  ${copy.fringe(time.fringe)}`}</Text> : null}
        <View style={styles.spacer} />
        {time.pinned ? <Chip palette={palette} label={copy.live} onPress={onLive} /> : null}
      </View>
    </View>
  );
}

function Card({ card, copy, palette, rtl, bottomInset, onClose, onRetry }: {
  card: NasijCard; copy: NasijCopy; palette: NasijPalette; rtl: boolean; bottomInset: number; onClose: () => void; onRetry: () => void;
}) {
  return (
    <View accessibilityViewIsModal={false} style={[styles.card, { height: CARD_PEEK, paddingBottom: Math.min(bottomInset, 16), backgroundColor: palette.card, borderColor: palette.colors.undyed }]}>
      <View style={[styles.row, rtl && styles.rowReverse]}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.cardTitle, { color: palette.text, textAlign: rtl ? 'right' : 'left' }]}>{card.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} hitSlop={12} style={styles.close}>
          <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.cardBody} accessibilityState={{ busy: card.status === 'LOADING' }}>
        {card.status === 'LOADING' ? (
          <>
            <View style={[styles.skeleton, { backgroundColor: palette.colors.undyed }]} />
            <View style={[styles.skeleton, styles.skeletonShort, { backgroundColor: palette.colors.undyed }]} />
            <View style={[styles.skeleton, { backgroundColor: palette.colors.undyed }]} />
          </>
        ) : card.status === 'UNAVAILABLE' ? (
          <>
            <Text style={[styles.cardLine, { color: palette.textQuiet }]}>{copy.unavailable}</Text>
            <View style={styles.row}><Chip palette={palette} label={copy.retry} onPress={onRetry} /></View>
          </>
        ) : card.status === 'ABSENT' ? (
          <Text style={[styles.cardLine, { color: palette.textQuiet }]}>{copy.absent}</Text>
        ) : (
          <>
            {card.meta.length > 0 ? <Text style={[styles.cardMeta, { color: palette.textQuiet }]}>{card.meta}</Text> : null}
            {card.lines.map((line, i) => <Text key={i} style={[styles.cardLine, { color: palette.text }]}>{line}</Text>)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export type { NasijWorldSnapshot };

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowReverse: { flexDirection: 'row-reverse' },
  spacer: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 3 },
  tab: { minHeight: 38, minWidth: 44, paddingHorizontal: 11, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  chip: { minHeight: 38, minWidth: 38, paddingHorizontal: 10, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  fixture: { alignSelf: 'center', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  back: { minHeight: 38, paddingHorizontal: 12 },
  bead: { minHeight: 38, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  beadDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, marginBottom: 2, transform: [{ rotate: '45deg' }] },
  beadText: { fontSize: 11 },
  lab: { flexGrow: 0 },
  labRow: { gap: 6 },
  hud: { alignSelf: 'flex-start', fontSize: 10, fontVariant: ['tabular-nums'], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', opacity: 0.86 },
  absence: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  absenceText: { fontSize: 14 },
  nearest: { flexDirection: 'row', gap: 6 },
  arrow: { fontSize: 12 },
  selvedge: { position: 'absolute', left: 10, right: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', height: 26 },
  tick: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 26 },
  tickBar: { width: 3, borderRadius: 2 },
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  close: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, lineHeight: 26 },
  cardBody: { flex: 1 },
  cardMeta: { fontSize: 12, marginBottom: 4 },
  cardLine: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  skeleton: { height: 12, borderRadius: 6, marginBottom: 8, opacity: 0.6 },
  skeletonShort: { width: '60%' },
});
