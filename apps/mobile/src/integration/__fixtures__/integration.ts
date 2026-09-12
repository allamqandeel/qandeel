/**
 * T-12 — shared scaffolding for the integration proofs.
 *
 * Everything below the seams is REAL: the store is the production kernel constructed with the
 * production Map, temporal and Return authorities, the bootstrap is T-12P's own, the transports are
 * the frozen T-03 ones, and the disclosures are wire-legal. What is substituted is exactly the two
 * things a test cannot have — a Supabase project and a network — and both are substituted through
 * T-12P's own public injection points rather than by reaching inside anything.
 *
 * The foreground signal defaults to INACTIVE so the live driver issues no request of its own. A
 * driver polling on a real timer through a test's HTTP double would make every other assertion race
 * it; the lifecycle rules that need it awake say so explicitly.
 */

import {
  TEST_CONFIG,
  authPortDouble,
  committedEvent,
  httpDouble,
  liveFocusEvent,
  serveHappyPath,
  settle,
  snapshot,
  worldDisclosure,
  SESSION_A,
  SESSION_B,
  type AuthPortDouble,
  type HttpDouble,
} from '../../runtime-entry/__fixtures__/runtime-entry';
import { createManualForegroundSignal, type ForegroundState, type ManualForegroundSignal } from '../../runtime-entry';
import { createEphemeralProductRecoveryStorage, type ProductRecoveryStorage } from '../../recovery';
import {
  createIntegrationRuntime,
  type IntegrationPhase,
  type IntegrationRuntime,
  type IntegrationSessionRuntime,
} from '../runtime/integration-runtime';

export {
  TEST_CONFIG,
  SESSION_A,
  SESSION_B,
  authPortDouble,
  committedEvent,
  httpDouble,
  liveFocusEvent,
  serveHappyPath,
  settle,
  snapshot,
  worldDisclosure,
};
export type { AuthPortDouble, HttpDouble };

export interface IntegrationHarness {
  readonly runtime: IntegrationRuntime;
  readonly auth: AuthPortDouble;
  readonly http: HttpDouble;
  readonly foreground: ManualForegroundSignal;
  /** T-13: the in-memory Product recovery storage this runtime reads and writes. Fresh per harness unless supplied. */
  readonly recoveryStorage: ProductRecoveryStorage;
  /** The READY session runtime, or a thrown error naming the phase that was reached instead. */
  ready(): IntegrationSessionRuntime;
  phase(): IntegrationPhase;
  dispose(): void;
}

export interface HarnessOptions {
  readonly initialSession?: { userId: string; accessToken: string } | null;
  readonly foreground?: ForegroundState;
  /** Skip the default happy-path routes so a test can register its own. */
  readonly serve?: boolean;
  readonly sessionId?: string;
  readonly liveHead?: number | null;
  /** T-13: a storage carried across two harnesses stands in for a storage that survived a process death. */
  readonly recoveryStorage?: ProductRecoveryStorage;
}

/**
 * Builds an integration runtime and drives it to whatever phase the given inputs produce.
 *
 * `start()` is awaited and then settled, so a harness returns only once the bootstrap chain has run
 * to completion — which is what lets a test assert on the phase rather than on a promise.
 */
export async function harness(options: HarnessOptions = {}): Promise<IntegrationHarness> {
  const sessionId = options.sessionId ?? SESSION_A;
  const http = httpDouble();
  if (options.serve !== false) {
    serveHappyPath(http, {
      sessionId,
      snapshot: snapshot({ sessionId, liveHead: options.liveHead === undefined ? 1 : options.liveHead }),
    });
  }
  const auth = authPortDouble(options.initialSession === undefined ? { userId: 'user-1', accessToken: 'token-1' } : options.initialSession);
  const foreground = createManualForegroundSignal(options.foreground ?? 'INACTIVE');
  const recoveryStorage = options.recoveryStorage ?? createEphemeralProductRecoveryStorage();

  const built = createIntegrationRuntime({ config: TEST_CONFIG, authPort: auth, foreground, httpFetch: http.fetch, recoveryStorage });
  if (!built.ok) throw new Error(`the harness could not build a runtime: ${built.phase.detail}`);
  const runtime = built.runtime;

  await runtime.start();
  await settle();

  return {
    runtime,
    auth,
    http,
    foreground,
    recoveryStorage,
    phase: () => runtime.getPhase(),
    ready() {
      const phase = runtime.getPhase();
      if (phase.kind !== 'READY') throw new Error(`expected READY, reached ${phase.kind}`);
      return phase.runtime;
    },
    dispose: () => runtime.dispose(),
  };
}
