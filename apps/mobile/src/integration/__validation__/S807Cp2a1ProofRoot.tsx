/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's proof root. VALIDATION ONLY.
 *
 * One build, two scenes, chosen by one tap on a plain validation chooser (no Product copy):
 *
 *   journey     R-1 / O-3 — the S7-04 proof root as it is (`S704ProofRoot`): the PRODUCTION phase surface over the
 *               production runtime, the proof world's in-memory identity and scripted network, and the REAL-PATH captured
 *               Replay wire. A part is chosen and saved in the Conversation; the saved line and its one action are the
 *               shipped ones, and the action opens the exact Replay just saved.
 *   continuous  R-2 / O-4, R-3 / O-5 — the shipped Replay player with the shipped original-audio surface (its one
 *               timeline included) over the labelled SYNTHETIC Replay Media Service and streaming player of the player
 *               tests (`original-audio/__fixtures__`), in real time: 1 text · 2 and 3 audio · 5 text · 6 audio, two
 *               recordings. The synthetic player plays nothing audible: what the native audio does on iOS is NOT TESTED
 *               here (the device pass's). A one-line readout (`cp2a1-proof-monitor.ts`) is laid over the timeline's
 *               held status line, where the gate reads it — absolutely placed, so it takes no room and moves nothing
 *               (CP2-A.1 correction round, "REPLAY UI FINAL CORRECTION" §3). It is drawn INSIDE the player: the player's
 *               root is `accessibilityViewIsModal`, so iOS hides anything beside it from the tree Maestro reads (CI on
 *               385c1b36: every continuous case NOT TESTED). Everything else on the screen is the Product's.
 *
 * Nothing on the Product route reaches this file: the proof build selects it through one recorded change of the
 * manifest's `main` (`scripts/select-s807cp2a1-proof-entry.mjs`).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore, createSystemAppearanceSource,
} from '../../appearance';
import { createReplayAudioSurface } from '../../original-audio/ReplayAudioViews';
import { REPLAY, SESSION, world } from '../../original-audio/__fixtures__/replay-audio-world';
import type { ReplayDraftHandoff } from '../../replay-entry';
import { ReplayPlayer, type ReplayPlayerSurface } from '../../replay-player';
import { deviceProductLanguage } from '../locale/device-locale';
import { createCp2a1ProofMonitor, formatCp2a1Reading, type Cp2a1ProofMonitor } from './cp2a1-proof-monitor';
import { S704ProofRoot } from './S704ProofRoot';

export const CP2A1_PROOF_READOUT_TEST_ID = 'irg-readout';

function Readout({ monitor }: { readonly monitor: Cp2a1ProofMonitor }) {
  const reading = useSyncExternalStore(monitor.subscribe, monitor.reading);
  const line = formatCp2a1Reading(reading);
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Text testID={CP2A1_PROOF_READOUT_TEST_ID} accessibilityLabel={line} style={styles.readout}>{line}</Text>
    </View>
  );
}

/** The shipped surface, its status line carrying the readout as well (validation only; nothing else changes). */
export function withReadout(surface: ReplayPlayerSurface, monitor: Cp2a1ProofMonitor): ReplayPlayerSurface {
  return {
    useControls: (view, language) => {
      const controls = surface.useControls(view, language);
      return controls === null ? null : { ...controls, status: <>{controls.status}<Readout monitor={monitor} /></> };
    },
  };
}

function buildContinuous() {
  const w = world();
  const monitor = createCp2a1ProofMonitor(w.player, w.clock);
  const surface = withReadout(createReplayAudioSurface(w.audio, monitor.controller), monitor);
  const appearance = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore(),
    system: createSystemAppearanceSource(),
    native: { apply: () => undefined },
  });
  return { w, monitor, surface, appearance };
}

function Continuous() {
  const [built] = useState(buildContinuous);
  const insets = useSafeAreaInsets();
  const [language] = useState(deviceProductLanguage);
  useEffect(() => {
    const stop = built.monitor.start();
    built.w.player.openSaved({
      sessionId: SESSION, replayId: REPLAY, draftRevision: 1, coverage: 'SELECTED_EXCERPT', selectedMomentCount: 6,
    } as unknown as ReplayDraftHandoff);
    return stop;
  }, [built]);
  return (
    <AppearanceProvider authority={built.appearance}>
      <ReplayPlayer controller={built.monitor.controller} language={language} insets={insets} surface={built.surface} />
    </AppearanceProvider>
  );
}

type Scene = 'journey' | 'continuous';

function Chooser({ onChoose }: { readonly onChoose: (scene: Scene) => void }) {
  return (
    <View style={styles.chooser}>
      {(['journey', 'continuous'] as const).map((scene) => (
        <Pressable key={scene} testID={`irg-choose-${scene}`} accessibilityRole="button" accessibilityLabel={scene} onPress={() => onChoose(scene)} style={styles.choice}>
          <Text style={styles.choiceText}>{scene}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function S807Cp2a1ProofRoot() {
  const [scene, setScene] = useState<Scene | null>(null);
  if (scene === 'journey') return <S704ProofRoot />;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
        <View style={styles.root}>
          <StatusBar style="auto" />
          {scene === null ? <Chooser onChoose={setScene} /> : <Continuous />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chooser: { flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 24 },
  choice: { minWidth: 200, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#888' },
  choiceText: { fontSize: 18, color: '#888' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  readout: { fontSize: 10, color: '#888', writingDirection: 'ltr', textAlign: 'left' },
});
