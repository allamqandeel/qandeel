/**
 * S7-03 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION composite, `ReplayMomentComposite` (the one Living Analysis surface and T-04's own
 * `MapSurface`), over the PRODUCTION `ReplayHistoryApiClient`, whose network is the REAL-PATH Replay wire captured from
 * PostgreSQL through the real `ReplayService` (`replay-composite/__fixtures__/replay-wire.ts`). Nothing on screen is
 * drawn by this file: it only chooses which captured scene, which moment, which language and which opening rung is shown.
 *
 * There is no player in S7-03 (S7-04 owns it), so a proof link stands in for the caller's choice of moment:
 *
 *   qandeel://s703-proof/show/<scene>/<ordinal>/<ar|en>[/<depth>]   one moment of one captured scene
 *   qandeel://s703-proof/preview/<openHead|legacy>/<ar|en>          a preview limit, as the real path answered it
 *
 *   <scene>  main · part · notViewable · analysisMoved · derivedGap (DERIVED SPECIMEN — said on screen)
 *   <depth>  WORLD · THREAD · SESSION · ANALYTICAL_OBJECT · SOURCE_PROVENANCE (the rung the viewpoint opens on)
 *
 * One line at the top says what the build is. It is validation tooling, in English, and is not Product copy.
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppearanceProvider,
  createAppearanceAuthority,
  createEphemeralAppearancePreferenceStore,
  createNativeAppearanceSink,
  createSystemAppearanceSource,
} from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import { ReplayMomentComposite, ReplayPreviewLimit, createReplayCompositeController } from '../../replay-composite';
import { REPLAY_WIRE, replayScene, replayWireClient, type ReplayProofSceneName } from '../../replay-composite/__fixtures__/replay-wire';
import type { SemanticDepth } from '../../state';

const SCENES: readonly ReplayProofSceneName[] = ['main', 'part', 'notViewable', 'analysisMoved', 'derivedGap'];
const DEPTHS: readonly SemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];
const LINK = /^qandeel:\/\/s703-proof\/(show|preview)\/([A-Za-z]+)(?:\/(\d+))?\/(ar|en)(?:\/([A-Z_]+))?$/u;

type Shown =
  | { readonly kind: 'MOMENT'; readonly scene: ReplayProofSceneName; readonly ordinal: number; readonly language: ChromeLanguage; readonly depth: SemanticDepth }
  | { readonly kind: 'PREVIEW'; readonly which: 'openHead' | 'legacy'; readonly language: ChromeLanguage };

function parse(url: string): Shown | null {
  const match = LINK.exec(url);
  if (match === null) return null;
  const [, verb, name, ordinal, language, depth] = match;
  if (verb === 'preview') return name === 'openHead' || name === 'legacy' ? { kind: 'PREVIEW', which: name, language: language as ChromeLanguage } : null;
  if (!(SCENES as readonly string[]).includes(name) || ordinal === undefined) return null;
  const opened = (depth ?? 'WORLD') as SemanticDepth;
  if (!DEPTHS.includes(opened)) return null;
  return { kind: 'MOMENT', scene: name as ReplayProofSceneName, ordinal: Number(ordinal), language: language as ChromeLanguage, depth: opened };
}

function ShownScreen({ shown }: { readonly shown: Shown }) {
  const insets = useSafeAreaInsets();
  const scene = shown.kind === 'MOMENT' ? shown.scene : null;
  // One controller per scene AND opening rung: a new rung is a new viewpoint, never a reused one.
  const controller = useMemo(() => {
    if (scene === null) return null;
    const wire = replayScene(scene);
    return createReplayCompositeController(replayWireClient(wire), wire.replayId, wire.versionId);
  }, [scene, shown.kind === 'MOMENT' ? shown.depth : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const banner = shown.kind === 'PREVIEW'
    ? `S7-03 VALIDATION BUILD · preview limit (${shown.which}) · real-path answer`
    : `S7-03 VALIDATION BUILD · ${shown.scene === 'derivedGap' ? 'DERIVED SPECIMEN (one declared edit)' : `real-path scene: ${shown.scene}`} · ordinal ${shown.ordinal}`;
  return (
    <View style={styles.root}>
      <View style={[styles.banner, { paddingTop: insets.top + 2 }]}><Text style={styles.bannerText}>{banner}</Text></View>
      <View style={styles.root}>
        {shown.kind === 'PREVIEW' ? (
          <ReplayPreviewLimit outcome={REPLAY_WIRE.preview[shown.which].outcome as 'MOMENT_NOT_SEALED' | 'ANALYSIS_UNAVAILABLE'} language={shown.language}
            insets={{ top: 0, right: insets.right, bottom: insets.bottom, left: insets.left }} />
        ) : controller === null ? null : (
          <ReplayMomentComposite key={`${shown.scene} ${shown.depth}`} controller={controller} ordinal={shown.ordinal} language={shown.language}
            initialDepth={shown.depth} insets={{ top: 0, right: insets.right, bottom: insets.bottom, left: insets.left }} />
        )}
      </View>
    </View>
  );
}

export function S703ProofRoot() {
  const [appearance] = useState(() => createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore(),
    system: createSystemAppearanceSource(),
    native: createNativeAppearanceSink(),
  }));
  const [shown, setShown] = useState<Shown>({ kind: 'MOMENT', scene: 'main', ordinal: 1, language: 'ar', depth: 'WORLD' });
  useEffect(() => {
    const take = (url: string | null) => {
      const next = url === null ? null : parse(url);
      if (next !== null) setShown(next);
    };
    void Linking.getInitialURL().then(take);
    const subscription = Linking.addEventListener('url', ({ url }) => take(url));
    return () => subscription.remove();
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
        <StatusBar style="light" />
        <AppearanceProvider authority={appearance}>
          <ShownScreen shown={shown} />
        </AppearanceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101010' },
  banner: { backgroundColor: '#3a2a00', paddingHorizontal: 10, paddingBottom: 3 },
  bannerText: { color: '#ffd27a', fontSize: 10 },
});
