/**
 * VPORT-02 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, exactly as `ProductRoot` and the VPORT-01 proof root
 * do, over a runtime built by the production `createIntegrationRuntime`, given the VPORT-01 proof world's in-memory
 * identity and scripted network (reused, not copied). Every module the reader sees — the Conversation, the depth door,
 * the VPORT-01 world, the Timeline with its Temporal Spine, the temporal orientation line and OrientationChrome — is the
 * shipped one.
 *
 * The device driver cannot scrub a strip by a precise Moment, so proof links reach the SAME production executors a
 * finger, a keyboard or a screen reader reaches; none writes state of its own:
 *
 *   qandeel://vport02-proof/pin/<n>      `commitMoment` — the T-06 commit a completed scrub or a tap makes → PINNED(n)
 *   qandeel://vport02-proof/preview/<n>  `preview.preview(…, 'EXACT_ENTRY')` — the T-06 navigator's exact entry route
 *   qandeel://vport02-proof/cancel       `preview.cancel()` — the navigator's cancel
 *   qandeel://vport02-proof/zoom-in|out  `zoomSemanticStep` — the pinch's settle and the accessible zoom actions
 *
 * Return Live is NOT a link: the flow taps the Live edge itself, its one canonical home.
 *
 * One thing is not the Product route, and says so on screen: the Call Rail SPECIMEN. There is no Voice / Live Call
 * runtime (`QAN-BL-VOICE-01`), so no Product surface mounts the rail; this entry renders the production `CallRail`
 * component alone, on the Analysis ground, with fixture states and the G1.2 R1 action labels as fixture words, so its
 * geometry can be seen on a device. It is never a call.
 *
 *   qandeel://vport02-proof/rail/<live-earpiece|muted-loudspeaker|connecting>   show the specimen in that state
 *   qandeel://vport02-proof/product                                             back to the Product surface
 */
import { useEffect, useState } from 'react';
import { I18nManager, Linking, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { analysisInk } from '../../analysis-visual';
import { CallRail, type CallRailLabels } from '../../iconography';
import { zoomSemanticStep } from '../../map';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { commitMoment } from '../../temporal-navigation/targeting';
import { temporalTargeting } from '../../temporal-navigation/targeting/disclosed-availability';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createVport01ProofWorld } from './vport01-proof-world';

const LINK = /^qandeel:\/\/vport02-proof\/(pin|preview|cancel|zoom-in|zoom-out|rail|product)(?:\/([a-z0-9-]+))?$/u;

/** FIXTURE words for the specimen only: G1.2 R1's action labels as the P2-A inventory lists them. Not Product copy. */
const SPECIMEN_LABELS: Readonly<Record<'ar' | 'en', CallRailLabels>> = {
  ar: { mute: 'كتم الميكروفون', unmute: 'تشغيل الميكروفون', route: 'السماعة الخارجية', endCall: 'إنهاء المكالمة' },
  en: { mute: 'Mute microphone', unmute: 'Unmute microphone', route: 'Loudspeaker', endCall: 'End call' },
};

type RailState = 'live-earpiece' | 'muted-loudspeaker' | 'connecting';

function buildProofRuntime(): IntegrationRuntime {
  const world = createVport01ProofWorld(deviceProductLanguage());
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the VPORT-02 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

function CallRailSpecimen({ state }: { readonly state: RailState }) {
  const language = deviceProductLanguage();
  const ink = analysisInk(false);
  return (
    <View style={[styles.specimen, { backgroundColor: ink.world }]} testID="vport02-call-rail-specimen">
      <Text style={[styles.caption, { color: ink.tertiary }]}>VALIDATION SPECIMEN — Call Rail A. No call runtime exists; nothing here is a call.</Text>
      <Text style={[styles.caption, { color: ink.tertiary }]}>{`state: ${state} · ${I18nManager.isRTL ? 'RTL' : 'LTR'}`}</Text>
      <View style={[styles.callLine, { borderColor: ink.tertiary }]}>
        <CallRail
          palette={ink}
          language={language}
          labels={SPECIMEN_LABELS[language]}
          muted={state === 'muted-loudspeaker'}
          route={state === 'connecting' ? null : state === 'muted-loudspeaker' ? 'LOUDSPEAKER' : 'EARPIECE'}
          onToggleMute={() => undefined}
          onToggleRoute={() => undefined}
          onEndCall={() => undefined}
        />
      </View>
    </View>
  );
}

export function Vport02ProofRoot() {
  const [runtime] = useState<IntegrationRuntime>(buildProofRuntime);
  const [rail, setRail] = useState<RailState | null>(null);
  useEffect(() => {
    const built = runtime;
    void built.start();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const match = LINK.exec(url);
      if (match === null) return;
      const [, verb, argument] = match;
      if (verb === 'rail') {
        if (argument === 'live-earpiece' || argument === 'muted-loudspeaker' || argument === 'connecting') setRail(argument);
        return;
      }
      if (verb === 'product') {
        setRail(null);
        return;
      }
      const phase = built.getPhase();
      if (phase.kind !== 'READY') return;
      const { store, preview, presentation } = phase.runtime;
      switch (verb) {
        case 'pin':
          commitMoment(store, Number(argument));
          return;
        case 'preview':
          preview.preview(temporalTargeting(store.getState(), presentation.getSnapshot().track), Number(argument), 'EXACT_ENTRY');
          return;
        case 'cancel':
          preview.cancel();
          return;
        case 'zoom-in':
        case 'zoom-out':
          zoomSemanticStep(store, verb === 'zoom-in' ? 'IN' : 'OUT');
          return;
        default:
          return;
      }
    });
    return () => {
      subscription.remove();
      built.dispose();
    };
  }, [runtime]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        <RuntimePhaseSurface runtime={runtime} />
        {rail === null ? null : (
          <View style={StyleSheet.absoluteFill}>
            <CallRailSpecimen state={rail} />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  specimen: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 48, rowGap: 8 },
  caption: { fontSize: 12, lineHeight: 18 },
  callLine: { height: 64, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
});
