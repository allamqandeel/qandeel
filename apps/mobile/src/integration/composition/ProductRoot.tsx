/**
 * T-12 §11 / §12 / `QAN-BL-T12-03` — the integrated Product root, and the app's only route output.
 *
 * > **QANDEEL navigation is canonical-state navigation, not a route stack.**
 *
 * This replaces T-01's technical `FoundationShell`. It is the only thing the router renders, and it
 * stays the only thing: World, Thread, Reading, Return, a Timeline position and an inspection depth
 * are canonical STATE, and none of them is a page. The router root is still exactly two files and
 * gains no third; going deeper into the world pushes nothing.
 *
 * ## What it owns, and it is a short list
 *
 * The three app-root providers nothing had mounted before — the gesture root, the safe-area provider
 * and the status bar — one integration runtime for the life of the mount, and the choice of which
 * surface is on screen for each runtime phase. Everything else is delegated.
 *
 * ## The technical states are technical, and say so
 *
 * Before a runtime exists there is no Product to show, and inventing one would be a lie of exactly
 * the kind this task exists to prevent: no Session, no `TC`, no `V`, no acts. So those phases render
 * a technical state view carrying no Product copy, no Product language and no visual language — the
 * same honesty `FoundationShell` had, for the same reason. The Product surface appears when, and only
 * when, there is a Product: an authenticated identity, a conversation Session, an authoritative
 * snapshot and one canonical store.
 *
 * The root's test ID is present in EVERY phase, which is what makes the boot smoke honest: it proves
 * the integrated root mounts and nothing more, and it can no longer be satisfied by the old technical
 * shell because the old technical shell is not rendered here at all, visibly or otherwise.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { deviceProductLocale } from '../locale/device-locale';
import { usePresentationFacts } from '../presentation/presentation-facts';
import { createIntegrationRuntime, type IntegrationPhase, type IntegrationRuntime } from '../runtime/integration-runtime';
import { LivingAnalysisMap } from './LivingAnalysisMap';

/** The one stable identifier the release boot smoke asserts. Present in every phase. */
export const PRODUCT_ROOT_TEST_ID = 'qandeel-product-root';
/** The technical pre-Product surface. Never a Product state, and never Product copy. */
export const RUNTIME_STATE_TEST_ID = 'qandeel-runtime-state';

/**
 * None, deliberately.
 *
 * An earlier draft took an options object so a test could inject the runtime seams. Nothing used it,
 * and an unused injection point on the PRODUCTION route component is exactly the hole PM-05 names: a
 * caller could hand the app a fixture config or a substituted auth port and it would look like
 * ordinary composition. The seams already exist one level down, on `createIntegrationRuntime`, where
 * a test can reach them without the route offering a way in.
 */
export type ProductRootProps = Record<never, never>;

/**
 * The technical state view.
 *
 * It is deliberately not Product UI: no Product language, no Product wording, no visual language, no
 * orientation sentence and no act. It names the runtime phase in engineering vocabulary, which is
 * what it is, and it is legible to a screen reader so a reader is never faced with a silent surface.
 */
function RuntimeState({ phase }: { readonly phase: IntegrationPhase['kind'] }) {
  return (
    <View
      style={styles.state}
      testID={RUNTIME_STATE_TEST_ID}
      // Engineering vocabulary, and English, because that is what it is: this is not the Product
      // speaking, and marking it as a Product language would be the first false note.
      accessibilityLanguage="en"
      // A reader waiting here is waiting for a state they cannot see change. `polite` announces the
      // phase when it moves without interrupting anything, which is the whole of what a status
      // surface owes a screen-reader user. It is a technical status, never a Product claim.
      accessibilityLiveRegion="polite"
      accessibilityRole="summary"
    >
      <Text accessibilityRole="header" style={styles.title}>
        QANDEEL
      </Text>
      <Text style={styles.phase}>{`runtime: ${phase}`}</Text>
    </View>
  );
}

export function ProductRoot() {
  // ONE runtime for the life of this mount. Built lazily so a re-render never constructs a second
  // one, and disposed on unmount so no driver, no fetch and no subscription outlives the surface.
  const [built] = useState(() => createIntegrationRuntime());
  const runtime = built.ok ? built.runtime : null;

  useEffect(() => {
    if (runtime === null) return;
    void runtime.start();
    return () => runtime.dispose();
  }, [runtime]);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/*
        The root identity sits ABOVE the safe-area provider, deliberately.

        `SafeAreaProvider` renders NOTHING until it has received real insets from the native side. A
        test ID placed inside it is therefore absent for the first frame — and on any host that never
        supplies them, absent for ever. The boot smoke makes exactly one claim, that the integrated
        root mounted, and that claim must not silently depend on a native measurement arriving. This
        was found by the route-level test and not by any composed-tree test, because those render the
        composition directly and never pass through here.
      */}
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        {runtime === null ? <RuntimeState phase="CONFIG_REFUSED" /> : <MountedRuntime runtime={runtime} />}
      </View>
    </GestureHandlerRootView>
  );
}

/**
 * The phase reader.
 *
 * The technical states need no insets — they are centred — so they render above the provider and are
 * visible immediately. Only the composed world sits inside it, which is also the only thing that
 * consumes an inset.
 */
function MountedRuntime({ runtime }: { readonly runtime: IntegrationRuntime }) {
  const phase = useSyncExternalStore(runtime.subscribe, runtime.getPhase);
  if (phase.kind !== 'READY') return <RuntimeState phase={phase.kind} />;
  return (
    // `initialMetrics` is the documented way to render on the first frame instead of waiting for the
    // native module to report. Without it the reader sees one blank frame between READY and the
    // world, which would read as the app stalling at exactly the moment it finished starting.
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
      <ComposedWorld runtime={phase.runtime} />
    </SafeAreaProvider>
  );
}

/** The world, with the two app-root presentation facts bound. Below the provider, by necessity. */
function ComposedWorld({ runtime }: { readonly runtime: Extract<IntegrationPhase, { kind: 'READY' }>['runtime'] }) {
  const { insets, fontScale, envelope } = usePresentationFacts();
  // Resolved once per mount: it is a presentation configuration, and re-reading it every render
  // would rebuild the value T-11 memoizes its whole plan on.
  const locale = useMemo(() => deviceProductLocale(), []);
  return <LivingAnalysisMap runtime={runtime} locale={locale} insets={insets} fontScale={fontScale} envelope={envelope} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  phase: { marginTop: 8, fontSize: 14 },
});
