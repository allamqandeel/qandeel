/**
 * T-10.0 MOTION LAB — the disposable prototype root (T-10.0 §9.1).
 *
 * This component is mounted by a LOCAL, untracked launcher only. It is not the app shell, not a
 * Product route, and nothing in production imports it (see `__tests__/isolation.test.ts`).
 *
 * Inside the phone frame everything with Product meaning is the real thing: the T-02 kernel with
 * the T-04/T-06/T-07 authorities, the real Map derivation and placement, T-05's presentation,
 * T-06's temporal target layer (scrub, preview, commit, Live edge, accessible routes) and T-08's
 * orientation chrome with its frozen bilingual copy. What the lab adds is the presentation of the
 * WORLD: one presentation camera and one presented set, shown under whichever direction is
 * selected. The controls beside the frame are a developer instrument and speak English.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { viewportEnvelope, type ViewportEnvelope } from '../map';
import { OrientationChrome, chromeProjection, mapProjectionRequest, returnActWords, type ChromeLanguage, type ReturnOpportunityId } from '../orientation-chrome';
import { isCurrentReturnCheckpointTargetForStore, latestReturnCheckpoint, type ReturnCheckpointTarget, type ReturnMapContext } from '../return-navigation';
import { effectiveTC, sessionPosition, type CanonicalStore } from '../state';
import { TemporalTargetLayer, createTemporalPreviewController } from '../temporal-navigation';
import { createPresentationController, disclosedTrack, type DisclosedTrack } from '../timeline';
import { LabControls } from './harness/LabControls';
import { SCENARIOS, runScenario, type ScenarioContext, type ScenarioId } from './harness/scenarios';
import { usePerfMeter } from './harness/usePerfMeter';
import { motionProfile, type DirectionId } from './motion/profiles';
import type { LabCameraBinding } from './motion/useLabCamera';
import { createCauseChannel, createLabActs, describeOutcome, type LabCause } from './truth/lab-acts';
import { labDisclosureEntry, labLiveContextProvider } from './truth/lab-projection';
import { createLabStore } from './truth/lab-store';
import { LAB_WORLD } from './truth/lab-world';
import { LabWorldSurface } from './world/LabWorldSurface';

export const MOTION_LAB_TEST_ID = 'qandeel-motion-lab';

/** A tall phone. The lower pane scrolls; the world keeps a fixed region so panning has room. */
const FRAME_WIDTH = 430;
const FRAME_HEIGHT = 932;
const WORLD_HEIGHT = 480;
const STATUS_LINES = 8;

const FALLBACK_ENVELOPE: ViewportEnvelope = Object.freeze({ width: FRAME_WIDTH, height: WORLD_HEIGHT, insetTop: 24, insetRight: 0, insetBottom: 16, insetLeft: 0 });

/** T-05's disclosed Track: the complete prefix through the mirrored Live Head (the lab's disclosure horizon). */
function trackFor(store: CanonicalStore): DisclosedTrack {
  const liveHead = store.getState().live.LH ?? 0;
  return disclosedTrack(LAB_WORLD.sessionId, Array.from({ length: liveHead }, (_unused, index) => ({ sessionPosition: sessionPosition(index + 1) })));
}

function useLabSession(resetToken: number) {
  return useMemo(() => {
    const store = createLabStore(LAB_WORLD);
    const preview = createTemporalPreviewController();
    const channel = createCauseChannel();
    const acts = createLabActs({ store, preview }, channel, LAB_WORLD);
    const presentation = createPresentationController(trackFor(store));
    // The chrome's composite act binds its spatial half through this provider; marking the cause
    // here lets the presentation show the arrival with the act's own choreography.
    const liveProvider = labLiveContextProvider(store, LAB_WORLD);
    const liveContext = (request: Parameters<typeof liveProvider>[0]): ReturnMapContext => {
      channel.mark('GO_LIVE_AND_LOCATE');
      return liveProvider(request);
    };
    return { store, preview, channel, acts, presentation, liveContext, token: resetToken };
  }, [resetToken]);
}

export function MotionLab() {
  const window = useWindowDimensions();
  const systemReduced = useReducedMotion();
  const [direction, setDirection] = useState<DirectionId>('A');
  const [reducedToggle, setReducedToggle] = useState(false);
  const [language, setLanguage] = useState<ChromeLanguage>('en');
  const [rtl, setRtl] = useState(false);
  const [ignition, setIgnition] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [status, setStatus] = useState<readonly string[]>([]);
  const [running, setRunning] = useState<ScenarioId | null>(null);
  const [origin, setOrigin] = useState<ReturnCheckpointTarget | null>(null);

  const reducedMotion = reducedToggle || systemReduced;
  const profile = useMemo(() => motionProfile(direction, reducedMotion), [direction, reducedMotion]);
  const session = useLabSession(resetToken);
  const { store, preview, channel, acts, presentation, liveContext } = session;
  const state = useSyncExternalStore(store.subscribe, store.getState);

  const pushStatus = useCallback((line: string) => {
    setStatus((previous) => [line, ...previous].slice(0, STATUS_LINES));
  }, []);

  // T-05's Track follows the mirrored Live Head, one way.
  useEffect(() => {
    const track = trackFor(store);
    if (track.targets.length !== presentation.getSnapshot().track.targets.length) presentation.replaceDisclosed(track);
  }, [store, presentation, state.live.LH]);

  const envelope = useMemo(() => viewportEnvelope(FRAME_WIDTH, WORLD_HEIGHT, { top: 24, bottom: 16 }) ?? FALLBACK_ENVELOPE, []);

  const cameraRef = useRef<LabCameraBinding | null>(null);
  const onCamera = useCallback((camera: LabCameraBinding) => {
    cameraRef.current = camera;
  }, []);
  const originRef = useRef<ReturnCheckpointTarget | null>(null);
  const bindOrigin = useCallback((target: ReturnCheckpointTarget | null) => {
    originRef.current = target;
    setOrigin(target);
  }, []);

  /** Runs an act with momentum settled first, and reports the store's answer. */
  const perform = useCallback(
    (run: () => Parameters<typeof describeOutcome>[0]) => {
      const camera = cameraRef.current;
      const outcome = camera === null ? run() : camera.settleThen(run);
      pushStatus(describeOutcome(outcome));
    },
    [pushStatus],
  );

  const stopScenario = useRef<(() => void) | null>(null);
  const onScenario = useCallback(
    (id: ScenarioId) => {
      const scenario = SCENARIOS.find((candidate) => candidate.id === id);
      const camera = cameraRef.current;
      if (scenario === undefined || camera === null) return;
      stopScenario.current?.();
      const context: ScenarioContext = {
        store,
        preview,
        presentation,
        acts,
        world: LAB_WORLD,
        envelope,
        camera,
        status: pushStatus,
        setOrigin: bindOrigin,
        getOrigin: () => originRef.current,
      };
      setRunning(id);
      const stop = runScenario(scenario, context);
      const last = scenario.steps[scenario.steps.length - 1]?.at ?? 0;
      const done = setTimeout(() => setRunning((current) => (current === id ? null : current)), last + 1500);
      stopScenario.current = () => {
        stop();
        clearTimeout(done);
        setRunning(null);
      };
    },
    [acts, bindOrigin, envelope, presentation, preview, pushStatus, store],
  );
  useEffect(() => () => stopScenario.current?.(), []);

  const onReset = useCallback(() => {
    stopScenario.current?.();
    bindOrigin(null);
    setStatus([]);
    setResetToken((value) => value + 1);
  }, [bindOrigin]);

  const onRtl = useCallback((on: boolean) => {
    // The production surfaces read `I18nManager.isRTL`. On the web renderer that flag is inert, so
    // the harness sets it before the remount below; on a device the platform setting needs a restart.
    if (Platform.OS === 'web') {
      (I18nManager as unknown as { isRTL: boolean }).isRTL = on;
    } else {
      I18nManager.forceRTL(on);
    }
    setRtl(on);
  }, []);

  const request = mapProjectionRequest(state);
  const projection = useMemo(
    () => (request === null ? { held: false as const, derivation: { status: 'PROJECTION_NOT_FETCHED' as const } } : chromeProjection(labDisclosureEntry(LAB_WORLD, state, request), request)),
    [request, state],
  );

  const exactWords = returnActWords(language, 'EXACT_RETURN');
  const exactAvailable = origin !== null && isCurrentReturnCheckpointTargetForStore(store, origin);

  const readout = [
    `mode ${state.temporal.kind === 'FOLLOW_LIVE' ? 'FOLLOW_LIVE' : `PINNED(${state.temporal.at})`} · effective TC ${effectiveTC(state) ?? '—'} · LH ${state.live.LH ?? '—'} · LF ${state.live.LF.value.kind}`,
    `depth ${state.camera.depth} · inspection ${state.inspection === null ? 'none' : 'set'} · reversible history ${state.history.length}`,
    `direction ${profile.id} ${profile.name}${reducedMotion ? ' · reduced motion' : ''} · copy ${language}${rtl ? ' · RTL' : ' · LTR'}`,
  ];

  const report = usePerfMeter(true);
  const wide = window.width >= FRAME_WIDTH + 560;
  const frameKey = `${session.token}-${rtl}-${language}`;
  const dirProps = Platform.OS === 'web' ? ({ dir: rtl ? 'rtl' : 'ltr' } as object) : {};

  const onReturnOutcome = useCallback(
    (id: ReturnOpportunityId, outcome: { readonly outcome: string; readonly locate?: string }) => {
      channel.mark(id as LabCause);
      pushStatus(`${id}: ${outcome.outcome}${outcome.locate === undefined ? '' : ` · ${outcome.locate}`}`);
    },
    [channel, pushStatus],
  );

  return (
    <View testID={MOTION_LAB_TEST_ID} style={[styles.root, wide ? styles.rootWide : null]}>
      <View style={styles.frame} key={frameKey} {...dirProps}>
        <LabWorldSurface
          store={store}
          preview={preview}
          world={LAB_WORLD}
          profile={profile}
          envelope={envelope}
          channel={channel}
          acts={acts}
          ignitionEnabled={ignition}
          onStatus={pushStatus}
          onCamera={onCamera}
        />
        <ScrollView style={styles.lower} contentContainerStyle={styles.lowerContent}>
          <TemporalTargetLayer
            store={store}
            preview={preview}
            presentation={presentation}
            onOutcome={(outcome) => {
              channel.mark('TEMPORAL');
              pushStatus(`temporal → ${outcome.outcome}`);
            }}
          />
          <View style={styles.labActs}>
            <LabActButton label="Zoom in" onPress={() => perform(() => acts.zoom('IN'))} />
            <LabActButton label="Zoom out" onPress={() => perform(() => acts.zoom('OUT'))} />
            <LabActButton label="Advance live" onPress={() => perform(() => acts.advanceLive())} />
            <LabActButton
              label={exactWords.label}
              hint={exactWords.hint}
              disabled={!exactAvailable}
              onPress={() => {
                const target = originRef.current;
                if (target !== null) perform(() => acts.exactReturn(target));
              }}
            />
            <LabActButton
              label="Bind origin"
              hint="lab only: the latest checkpoint becomes the journey origin"
              onPress={() => {
                const target = latestReturnCheckpoint(store);
                bindOrigin(target);
                pushStatus(target === null ? 'no checkpoint to bind' : `origin bound to checkpoint #${target.index}`);
              }}
            />
          </View>
          <OrientationChrome
            surface={{ store, preview }}
            language={language}
            projection={projection}
            preview={preview}
            liveContext={liveContext}
            onReturnOutcome={onReturnOutcome}
            onMapOutcome={(outcome) => pushStatus(`map → ${outcome.outcome}`)}
            bottomInset={12}
          />
        </ScrollView>
      </View>
      <LabControls
        direction={direction}
        profile={profile}
        reducedMotion={reducedToggle}
        systemReducedMotion={systemReduced}
        language={language}
        rtl={rtl}
        ignition={ignition}
        scenarios={SCENARIOS}
        runningScenario={running}
        report={report}
        readout={readout}
        status={status}
        onDirection={setDirection}
        onReducedMotion={setReducedToggle}
        onLanguage={setLanguage}
        onRtl={onRtl}
        onIgnition={setIgnition}
        onScenario={onScenario}
        onStopScenario={() => stopScenario.current?.()}
        onReset={onReset}
      />
    </View>
  );
}

function LabActButton({ label, hint, disabled = false, onPress }: { readonly label: string; readonly hint?: string; readonly disabled?: boolean; readonly onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.act, disabled ? styles.actDisabled : null]}>
      <Text style={styles.actLabel}>{label}</Text>
      {hint === undefined ? null : <Text style={styles.actHint}>{hint}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgb(232,229,222)', padding: 16, rowGap: 16 },
  rootWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', columnGap: 24 },
  frame: { width: FRAME_WIDTH, height: FRAME_HEIGHT, borderRadius: 32, overflow: 'hidden', backgroundColor: 'rgb(250,249,246)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  lower: { flex: 1 },
  lowerContent: { paddingBottom: 24 },
  labActs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  act: { minHeight: 36, maxWidth: 190, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)', justifyContent: 'center' },
  actDisabled: { opacity: 0.4 },
  actLabel: { fontSize: 13, lineHeight: 20 },
  actHint: { fontSize: 11, lineHeight: 16, opacity: 0.7 },
});
