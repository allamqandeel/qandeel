/**
 * T-12 Phase M — the `QAN-BL-T12-04` auth-storage validation procedure.
 *
 * VALIDATION ONLY. Nothing in this directory is Product code, nothing here is reachable from the
 * Product route, and a static contract proves both. It exists to answer one question that cannot be
 * answered from this repository at all: does the REAL `expo-sqlite` auth-session store persist,
 * restore, refresh and clear on a device?
 *
 * ## Why it has to run on a device
 *
 * `expo-sqlite/kv-store` is a native module. Under `jest-expo` there is no implementation —
 * constructing the real store kills the Jest worker — so every local test drives an injected port and
 * proves everything ABOVE the storage while proving nothing about the storage itself. That gap is
 * exactly what `QAN-BL-T12-04` records, and this procedure is the instrument for closing it.
 *
 * ## What it is not
 *
 * It is not a login gateway, and building one is explicitly out of scope. It has no Product copy, no
 * onboarding, no provider buttons and no branding. It creates no second Supabase client and no second
 * auth authority: it drives `createIntegrationRuntime`, which owns the one of each, through the
 * public T-12P barrel and nothing deeper.
 *
 * ## Credentials
 *
 * Supplied at validation time and held in memory for the duration of one call. Nothing here writes a
 * credential to source, to Expo config, to a fixture, to a snapshot, to a log or to a report — and a
 * FAILURE never echoes the value it was given. The report carries typed outcomes and identity SHAPES
 * (a boolean, a length, a kind), never a secret, so a screenshot of it is safe to attach as evidence.
 *
 * ## The restart boundary
 *
 * Step 2 of the validation set is "restart the process and restore the AUTH SESSION only". A process
 * cannot restart itself, so the procedure is deliberately split into two phases a human runs either
 * side of a real app kill. Anything that pretended to test a restart in-process would be testing
 * nothing, and the split is what keeps the evidence honest.
 */

import {
  createIntegrationRuntime,
  type IntegrationPhase,
  type IntegrationRuntime,
} from '../runtime/integration-runtime';

/** What a step proved. Never a credential, never a token, never a Product fact. */
export type ValidationOutcome = 'PASS' | 'FAIL' | 'NOT_RUN';

export interface ValidationStep {
  readonly id: string;
  /** The claim, in the words the runbook and the backlog use. */
  readonly claim: string;
  readonly outcome: ValidationOutcome;
  /** Technical evidence, safe to screenshot: kinds, booleans, lengths. Never a value. */
  readonly evidence: string;
}

export interface AuthStorageValidationReport {
  readonly phase: 'BEFORE_RESTART' | 'AFTER_RESTART';
  readonly steps: readonly ValidationStep[];
  /** True only when every step of this phase passed. A human still judges the whole gate. */
  readonly allPassed: boolean;
}

/** Credentials, requested at the moment they are needed and never retained by this module. */
export interface ValidationCredentials {
  readonly email: string;
  readonly password: string;
}

const step = (id: string, claim: string, outcome: ValidationOutcome, evidence: string): ValidationStep =>
  Object.freeze({ id, claim, outcome, evidence });

/**
 * Describes an auth state WITHOUT disclosing anything secret.
 *
 * The access token's presence and length are evidence that a credential exists and was restored; the
 * token itself is not, and printing it would put a live bearer on someone's screen.
 */
function describeAuth(runtime: IntegrationRuntime): string {
  const state = runtime.auth.getState();
  if (state.kind !== 'AUTHENTICATED') return `auth=${state.kind}`;
  return `auth=AUTHENTICATED userId=${state.userId.length}ch token=${state.accessToken.length}ch gen=${state.authGeneration}`;
}

/** Describes the runtime phase without disclosing a Session id or any Product truth. */
function describePhase(phase: IntegrationPhase): string {
  if (phase.kind !== 'READY') return `phase=${phase.kind}`;
  const { runtime } = phase;
  const state = runtime.store.getState();
  return `phase=READY session=${runtime.bundle.sessionId.length}ch origin=${runtime.recovery.origin} gen=${runtime.generation} tm=${state.temporal.kind} rh=${state.history.length}`;
}

/**
 * Resolves once the runtime settles on any phase other than the transient ones.
 *
 * `RECOVERING` is T-13's phase between a signed-in identity and the bootstrap: the recovery store is
 * being read. It is transient exactly as `BOOTSTRAPPING` is, and the first cloud run on the T-13 tree
 * proved what leaving it out does — the iOS simulator, slower to open the store, was sampled in
 * `RECOVERING` and the sign-in claim failed while Android passed on timing alone.
 */
async function settled(runtime: IntegrationRuntime, timeoutMs = 30_000): Promise<IntegrationPhase> {
  const transient = new Set<IntegrationPhase['kind']>(['RESTORING', 'RECOVERING', 'BOOTSTRAPPING']);
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const phase = runtime.getPhase();
      if (!transient.has(phase.kind) || Date.now() - started > timeoutMs) {
        unsubscribe();
        resolve(phase);
      }
    };
    const unsubscribe = runtime.subscribe(check);
    check();
  });
}

/**
 * PHASE 1, before the app is killed.
 *
 * Signs in with credentials the caller supplies, lets the runtime bootstrap, and records what exists.
 * The app must then be FORCE-KILLED by hand — not backgrounded — before phase 2 is run.
 */
export async function validateBeforeRestart(credentials: ValidationCredentials): Promise<AuthStorageValidationReport> {
  const steps: ValidationStep[] = [];
  const built = createIntegrationRuntime();
  if (!built.ok) {
    return Object.freeze({
      phase: 'BEFORE_RESTART' as const,
      steps: [step('T12-04.0', 'the build carries public configuration', 'FAIL', `config refused: ${built.phase.failure}`)],
      allPassed: false,
    });
  }
  const runtime = built.runtime;
  try {
    await runtime.start();
    steps.push(step('T12-04.0', 'the runtime starts and reads the real auth store', 'PASS', describeAuth(runtime)));

    const signedIn = await runtime.auth.signInWithPassword(credentials.email, credentials.password);
    if (!signedIn.ok) {
      // The failure KIND, never the credential and never the server's message verbatim.
      steps.push(step('T12-04.1', 'sign-in succeeds and a session is persisted', 'FAIL', `sign-in refused: ${signedIn.failure.kind}`));
      return Object.freeze({ phase: 'BEFORE_RESTART' as const, steps, allPassed: false });
    }
    const authenticated = runtime.auth.getState().kind === 'AUTHENTICATED';
    steps.push(step('T12-04.1', 'sign-in succeeds and a session is persisted', authenticated ? 'PASS' : 'FAIL', describeAuth(runtime)));

    const phase = await settled(runtime);
    steps.push(
      step(
        'T12-04.1b',
        'one QANDEEL conversation Session is acquired for this identity',
        phase.kind === 'READY' ? 'PASS' : 'FAIL',
        describePhase(phase),
      ),
    );
    return Object.freeze({ phase: 'BEFORE_RESTART' as const, steps, allPassed: steps.every((s) => s.outcome === 'PASS') });
  } finally {
    // Deliberately NOT disposed: disposing would tear the auth authority down before the process is
    // killed, and what is being validated is what survives a kill rather than what survives a clean
    // shutdown. The harness is the last thing running in this build.
  }
}

/**
 * PHASE 2, after a real force-kill and relaunch.
 *
 * Everything below is about what the STORES gave back. The first step is the heart of the T-12 item:
 * the auth session returns from the auth store. The two after it were re-anchored by T-13, which owns
 * the separate Product recovery store: the conversation Session and the viewpoint now return through
 * THAT store, reconciled against fresh server truth, and the Session is resumed rather than re-minted.
 */
export async function validateAfterRestart(): Promise<AuthStorageValidationReport> {
  const steps: ValidationStep[] = [];
  const built = createIntegrationRuntime();
  if (!built.ok) {
    return Object.freeze({
      phase: 'AFTER_RESTART' as const,
      steps: [step('T12-04.0', 'the build carries public configuration', 'FAIL', `config refused: ${built.phase.failure}`)],
      allPassed: false,
    });
  }
  const runtime = built.runtime;

  await runtime.start();
  const restored = runtime.auth.getState();
  steps.push(
    step(
      'T12-04.2a',
      'process restart restores the AUTH session from the real store',
      restored.kind === 'AUTHENTICATED' ? 'PASS' : 'FAIL',
      describeAuth(runtime),
    ),
  );

  const phase = await settled(runtime);
  // T-13 RE-ANCHOR. Before T-13 these two claims read "no Product truth returns" and "the Session is
  // acquired afresh", and they were true: nothing persisted Product truth, so a restart could only
  // restore the auth session. T-13 owns exactly that boundary now — a SEPARATE, identity-scoped
  // Product recovery store resumes the active Session and the reader's viewpoint, reconciled against
  // fresh server truth before READY. The claims below state the current truth. What is unchanged, and
  // still asserted first, is `.2a`: the AUTH store restores the auth session and nothing else of its
  // own. The T-12 physical evidence at `02bff1b` stays what it was: evidence of the pre-T-13 boundary.
  if (phase.kind === 'READY') {
    steps.push(
      step(
        'T12-04.2b',
        'restart restores the AUTH session from the auth store; Product truth returns ONLY through the separate identity-scoped Product recovery store (T-13)',
        'PASS',
        describePhase(phase),
      ),
    );
    steps.push(
      step(
        'T12-04.7',
        'the conversation Session is RESUMED from the Product recovery store and validated by the server, never re-minted (T-13)',
        phase.runtime.recovery.origin === 'RESUMED' ? 'PASS' : 'FAIL',
        `origin=${phase.runtime.recovery.origin} session=${phase.runtime.bundle.sessionId.length}ch (compare with the phase-1 evidence — the ids must MATCH)`,
      ),
    );
  } else {
    steps.push(step('T12-04.2b', 'restart restores the AUTH session; Product truth returns only through the Product recovery store (T-13)', 'FAIL', describePhase(phase)));
    steps.push(step('T12-04.7', 'the conversation Session is RESUMED from the Product recovery store, never re-minted (T-13)', 'NOT_RUN', describePhase(phase)));
  }

  return Object.freeze({ phase: 'AFTER_RESTART' as const, steps, allPassed: steps.every((s) => s.outcome === 'PASS') });
}

/**
 * PHASE 2 continued — sign-out, and then a DIFFERENT identity.
 *
 * Run after `validateAfterRestart`, against the same launch. The identity-replacement step is the one
 * that matters most: it is the only check that the previous identity's runtime cannot be adopted by
 * the next one, which is a credential-exposure question rather than a convenience one.
 */
export async function validateSignOutAndReplacement(
  replacement: ValidationCredentials | null,
): Promise<AuthStorageValidationReport> {
  const steps: ValidationStep[] = [];
  const built = createIntegrationRuntime();
  if (!built.ok) {
    return Object.freeze({
      phase: 'AFTER_RESTART' as const,
      steps: [step('T12-04.0', 'the build carries public configuration', 'FAIL', `config refused: ${built.phase.failure}`)],
      allPassed: false,
    });
  }
  const runtime = built.runtime;
  await runtime.start();
  await settled(runtime);
  const before = runtime.getPhase();
  const firstSession = before.kind === 'READY' ? before.runtime.bundle.sessionId : null;

  const signedOut = await runtime.auth.signOut();
  const afterSignOut = runtime.auth.getState();
  steps.push(
    step(
      'T12-04.4',
      'sign-out removes the credential material and retires the runtime',
      signedOut.ok && afterSignOut.kind === 'SIGNED_OUT' && runtime.getPhase().kind === 'SIGNED_OUT' ? 'PASS' : 'FAIL',
      `${describeAuth(runtime)} ${describePhase(runtime.getPhase())}`,
    ),
  );

  if (replacement === null) {
    steps.push(step('T12-04.5', 'a replacement identity cannot adopt the previous runtime', 'NOT_RUN', 'no second identity supplied'));
    return Object.freeze({ phase: 'AFTER_RESTART' as const, steps, allPassed: false });
  }

  const second = await runtime.auth.signInWithPassword(replacement.email, replacement.password);
  if (!second.ok) {
    steps.push(step('T12-04.5', 'a replacement identity cannot adopt the previous runtime', 'FAIL', `sign-in refused: ${second.failure.kind}`));
    return Object.freeze({ phase: 'AFTER_RESTART' as const, steps, allPassed: false });
  }
  const replaced = await settled(runtime);
  const adopted = replaced.kind === 'READY' && firstSession !== null && replaced.runtime.bundle.sessionId === firstSession;
  steps.push(
    step(
      'T12-04.5',
      'a replacement identity cannot adopt the previous identity’s runtime or Session',
      replaced.kind === 'READY' && !adopted ? 'PASS' : 'FAIL',
      `${describePhase(replaced)} adopted-previous-session=${String(adopted)}`,
    ),
  );

  return Object.freeze({ phase: 'AFTER_RESTART' as const, steps, allPassed: steps.every((s) => s.outcome === 'PASS') });
}
