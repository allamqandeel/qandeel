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
 * ## Which phase gets which surface (T-14)
 *
 * TWO phases are reader-facing, and they show different things because the reader is in genuinely
 * different situations:
 *
 *   `SIGNED_OUT`  — nobody is authenticated. This is a correct resting state rather than a failure,
 *                   and the one thing the reader needs is a way in, so it renders the Product
 *                   sign-in entry. That surface carries NO Session, NO world and NO Product truth:
 *                   there is no `TC`, no `V`, no act and no canonical store behind it, and it claims
 *                   none. It collects a credential, hands it to the frozen auth authority, and is
 *                   replaced by whatever the runtime decides comes next.
 *
 *   `READY`       — there is an authenticated identity, a conversation Session, an authoritative
 *                   snapshot and one canonical store, so there is a world: the Living Analysis Map,
 *                   composed after the authenticated bootstrap reconciled against server authority.
 *
 * ## Every remaining phase is technical, and says so
 *
 * `CONFIG_REFUSED`, `RESTORING`, `AUTH_ERROR`, `RECOVERING`, `BOOTSTRAPPING`, `BOOTSTRAP_FAILED` and
 * `RECOVERY_FAILED` are a failure or transient work the reader did not ask about. For each of them
 * there is no Product to show, and inventing one would be a lie of exactly the kind this file exists
 * to prevent. So they render a technical state view carrying no Product copy, no Product language and
 * no visual language — the same honesty `FoundationShell` had, for the same reason.
 *
 * The distinction is between "not signed in" and "something is loading or broken", not between
 * "before READY" and "at READY": a signed-out entry is honest because it promises nothing, while a
 * Product frame over `RECOVERING` or `RECOVERY_FAILED` would promise a world that does not exist.
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

import type { MobileAuthAuthority } from '../../runtime-entry';
import { ProductSignInGateway } from '../auth-gateway';
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
        {runtime === null ? <RuntimeState phase="CONFIG_REFUSED" /> : <RuntimePhaseSurface runtime={runtime} />}
      </View>
    </GestureHandlerRootView>
  );
}

/**
 * The phase reader, and the whole of T-14's structural change.
 *
 * TWO phases now have a reader-facing surface, and they are the only two that can honestly have one:
 *
 *   `READY`       — there is an authenticated identity, a Session, an authoritative snapshot and one
 *                   canonical store, so there is a world to show;
 *   `SIGNED_OUT`  — nobody is authenticated, which is a correct resting state rather than a failure,
 *                   and the one thing a reader in it actually needs is a way in.
 *
 * Every OTHER phase stays exactly what it was: a technical state, in engineering vocabulary, with no
 * Product copy and no Product claim. `RESTORING`, `RECOVERING` and `BOOTSTRAPPING` are transient work
 * the reader did not ask about, and `AUTH_ERROR`, `BOOTSTRAP_FAILED`, `RECOVERY_FAILED` and
 * `CONFIG_REFUSED` are failures. Dressing any of them as a Product state would be inventing
 * reassurance the runtime cannot back — the same lie the technical state view exists to refuse.
 *
 * The signed-out surface calls one already-frozen capability and owns nothing else. It does not
 * bootstrap, does not navigate, and does not create a Session: when it succeeds the auth authority
 * publishes authentication, this same phase machinery moves on, and the surface is simply replaced.
 *
 * Both reader-facing phases sit inside the safe-area provider, because both are laid out against the
 * reader's real device. The technical states need no insets — they are centred — so they still render
 * above it and are visible immediately.
 *
 * Exported for the integration proofs, which drive it over a runtime the harness genuinely built.
 * It is not published from the layer barrel, and it offers no seam of its own: the only thing it can
 * be given is an `IntegrationRuntime`, which only `createIntegrationRuntime` can produce.
 */
export function RuntimePhaseSurface({ runtime }: { readonly runtime: IntegrationRuntime }) {
  const phase = useSyncExternalStore(runtime.subscribe, runtime.getPhase);
  // `initialMetrics` is the documented way to render on the first frame instead of waiting for the
  // native module to report. Without it the reader sees one blank frame before the surface, which
  // would read as the app stalling at exactly the moment it finished starting.
  if (phase.kind === 'READY') {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
        <ComposedWorld runtime={phase.runtime} />
      </SafeAreaProvider>
    );
  }
  if (phase.kind === 'SIGNED_OUT') {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
        <SignedOutEntry auth={runtime.auth} />
      </SafeAreaProvider>
    );
  }
  return <RuntimeState phase={phase.kind} />;
}

/**
 * The Product entry, with the one app-level locale bound.
 *
 * Resolved once per mount, exactly as the composed world resolves it: it is a presentation
 * configuration, and there is one authority for it in the app rather than one per surface.
 */
function SignedOutEntry({ auth }: { readonly auth: MobileAuthAuthority }) {
  const locale = useMemo(() => deviceProductLocale(), []);
  return <ProductSignInGateway auth={auth} locale={locale} />;
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
