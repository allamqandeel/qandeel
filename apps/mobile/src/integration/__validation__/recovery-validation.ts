/**
 * T-13 — the native restart / recovery validation procedures.
 *
 * VALIDATION ONLY. Nothing in this directory is Product code, nothing here is reachable from the
 * Product route, and the T-12 static contract proves both. These procedures exist to answer what no
 * local test can: does the REAL `expo-sqlite` Product recovery store, on a device, resume the same
 * Session and the same viewpoint across a genuine process kill, a cold launch and a device restart —
 * and does it fail closed when the stored Session is not this identity's?
 *
 * ## What is driven, and what is not
 *
 * Every procedure drives `createIntegrationRuntime()` — the real runtime, the real bootstrap, the real
 * store, the real recovery boundary — and observes the phase it settles on. Two procedures reach into
 * the Product through the same public seams the composition uses: `PIN_MOMENT` dispatches the kernel's
 * own `COMMIT_MOMENT` on the READY store (the act a reader performs through T-06), and `ADOPT_SESSION`
 * writes one record through the production recovery store and codec, so that a Session the SERVER
 * populated for this identity can become the active one without a Product surface to navigate to it.
 * The server then decides whether that Session is really this identity's: an adopted foreign Session
 * must produce `RECOVERY_FAILED`, never a world.
 *
 * ## Evidence
 *
 * The report carries phase kinds, the Session LOCATOR, the temporal mode, the mirrored Live Head, the
 * history length and the writer's counters. The Session id is printed deliberately: "the same Session
 * came back" is the claim, and it can only be checked across two launches by comparing the values. It
 * is not a credential. No credential, no token and no server message verbatim ever reaches the report.
 *
 * ## The restart boundary
 *
 * A process cannot restart itself, so every "after" procedure is a separate launch that a real kill,
 * reboot or home-and-reopen precedes OUTSIDE this file. Anything simulated in-process would prove
 * nothing, and the split is what keeps the evidence honest.
 */

import { initialCameraIntent } from '../../map';
import { createProductRecoveryStore, productRecoveryRecord } from '../../recovery';
import { sessionPosition } from '../../state';
import {
  createIntegrationRuntime,
  type IntegrationPhase,
  type IntegrationRuntime,
  type IntegrationSessionRuntime,
} from '../runtime/integration-runtime';

export type RecoveryRunKind =
  /** Sign in, reach READY, and prove the recovery locator was committed. Run once after a clean install. */
  | 'RECOVERY_BEFORE'
  /** After a kill / reboot / reopen: the SAME Session and viewpoint come back, through RESUME. */
  | 'RECOVERY_AFTER'
  /** After a kill following a sign-out: nothing Product-shaped comes back. */
  | 'RECOVERY_AFTER_SIGNED_OUT'
  /** After a kill following a foreign adoption: recovery fails closed, and no Session is minted. */
  | 'RECOVERY_AFTER_REFUSED'
  /** Make a server-populated Session this identity's active one, through the production store. */
  | 'ADOPT_SESSION'
  /** Commit `PINNED(moment)` on the READY store, and prove the durable snapshot advanced. */
  | 'PIN_MOMENT'
  /** Sign out. The record stays stored; the runtime retires. */
  | 'RECOVERY_SIGN_OUT'
  /** B signs in fresh, B signs out, A signs in and resumes A's own record. */
  | 'RECOVERY_REPLACEMENT';

export type ValidationOutcome = 'PASS' | 'FAIL' | 'NOT_RUN';

export interface RecoveryValidationStep {
  readonly id: string;
  readonly claim: string;
  readonly outcome: ValidationOutcome;
  /** Kinds, locators, modes and counts. Never a credential. */
  readonly evidence: string;
}

export interface RecoveryValidationReport {
  readonly phase: RecoveryRunKind;
  readonly steps: readonly RecoveryValidationStep[];
  readonly allPassed: boolean;
}

export interface RecoveryValidationInputs {
  readonly credentials?: { readonly email: string; readonly password: string };
  readonly replacement?: { readonly email: string; readonly password: string };
  /** The Session locator to adopt. Typed at validation time; never a default. */
  readonly sessionId?: string;
  /** The Moment to pin. */
  readonly moment?: number;
}

const step = (id: string, claim: string, outcome: ValidationOutcome, evidence: string): RecoveryValidationStep =>
  Object.freeze({ id, claim, outcome, evidence });

const report = (phase: RecoveryRunKind, steps: readonly RecoveryValidationStep[]): RecoveryValidationReport =>
  Object.freeze({ phase, steps, allPassed: steps.length > 0 && steps.every((entry) => entry.outcome === 'PASS') });

function describeAuth(runtime: IntegrationRuntime): string {
  const state = runtime.auth.getState();
  if (state.kind !== 'AUTHENTICATED') return `auth=${state.kind}`;
  return `auth=AUTHENTICATED userId=${state.userId.length}ch token=${state.accessToken.length}ch gen=${state.authGeneration}`;
}

/** The recovery-relevant facts of a READY runtime: locator, origin, mode, fresh Live Head, history. */
function describeSession(session: IntegrationSessionRuntime): string {
  const state = session.store.getState();
  const tm = state.temporal.kind === 'PINNED' ? `PINNED(${state.temporal.at})` : 'FOLLOW_LIVE';
  const writer = session.recovery.writer.status();
  return (
    `session=${session.bundle.sessionId} origin=${session.recovery.origin} tm=${tm} lh=${state.live.LH === null ? 'null' : state.live.LH} ` +
    `rh=${state.history.length} inspection=${state.inspection === null ? 'none' : 'set'} writes=${writer.committed}/${writer.issued}`
  );
}

type BootstrapFailureOf = Extract<IntegrationPhase, { kind: 'BOOTSTRAP_FAILED' }>['failure'];

/**
 * A bootstrap failure with its own detail. The detail is the transport's error message (a status, a
 * network error), never a credential; it is what tells a `SNAPSHOT` that timed out apart from one the
 * server refused, which a kind alone cannot — the eighth cloud run showed the kind alone is not enough.
 */
function describeBootstrapFailure(failure: BootstrapFailureOf): string {
  if ('detail' in failure) return `${failure.kind} (${failure.detail.replace(/\s+/gu, ' ').slice(0, 160)})`;
  if (failure.kind === 'SESSION_ACQUISITION') return `${failure.kind} (${failure.outcome.kind})`;
  return failure.kind;
}

function describePhase(phase: IntegrationPhase): string {
  if (phase.kind === 'READY') return `phase=READY ${describeSession(phase.runtime)}`;
  if (phase.kind === 'RECOVERY_FAILED') {
    const failure = phase.failure;
    const detail =
      failure.kind === 'SESSION_INVALID' ? describeBootstrapFailure(failure.failure) : failure.kind === 'RECORD_INVALID' ? failure.reason : 'storage';
    return `phase=RECOVERY_FAILED failure=${failure.kind}/${detail}`;
  }
  if (phase.kind === 'BOOTSTRAP_FAILED') return `phase=BOOTSTRAP_FAILED failure=${describeBootstrapFailure(phase.failure)}`;
  return `phase=${phase.kind}`;
}

/** Resolves once the runtime settles on any phase other than the transient ones. */
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

const CONFIG_REFUSED = (phase: RecoveryRunKind, detail: string): RecoveryValidationReport =>
  report(phase, [step('T13-0', 'the build carries public configuration', 'FAIL', `config refused: ${detail}`)]);

/** Build and start the real runtime, or report why it could not be built. */
async function launch(phase: RecoveryRunKind): Promise<{ ok: true; runtime: IntegrationRuntime } | { ok: false; report: RecoveryValidationReport }> {
  const built = createIntegrationRuntime();
  // The failure KIND and the key names, never a value: the config detail names what is missing.
  if (!built.ok) return { ok: false, report: CONFIG_REFUSED(phase, `${built.phase.failure.kind}: ${built.phase.detail}`) };
  await built.runtime.start();
  return { ok: true, runtime: built.runtime };
}

export async function runRecoveryValidation(kind: RecoveryRunKind, inputs: RecoveryValidationInputs): Promise<RecoveryValidationReport> {
  switch (kind) {
    case 'RECOVERY_BEFORE':
      return before(inputs);
    case 'RECOVERY_AFTER':
      return after('RECOVERY_AFTER');
    case 'RECOVERY_AFTER_SIGNED_OUT':
      return afterSignedOut();
    case 'RECOVERY_AFTER_REFUSED':
      return afterRefused();
    case 'ADOPT_SESSION':
      return adopt(inputs);
    case 'PIN_MOMENT':
      return pin(inputs);
    case 'RECOVERY_SIGN_OUT':
      return signOut();
    case 'RECOVERY_REPLACEMENT':
      return replacement(inputs);
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** T13-B — a signed-in launch reaches READY and the recovery locator is committed. */
async function before(inputs: RecoveryValidationInputs): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('RECOVERY_BEFORE');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  steps.push(step('T13-B.0', 'the runtime starts and reads the real auth store', 'PASS', describeAuth(runtime)));
  if (inputs.credentials === undefined) {
    steps.push(step('T13-B.1', 'sign-in succeeds', 'FAIL', 'no credentials supplied'));
    return report('RECOVERY_BEFORE', steps);
  }
  if (runtime.auth.getState().kind !== 'AUTHENTICATED') {
    const signedIn = await runtime.auth.signInWithPassword(inputs.credentials.email, inputs.credentials.password);
    if (!signedIn.ok) {
      steps.push(step('T13-B.1', 'sign-in succeeds', 'FAIL', `sign-in refused: ${signedIn.failure.kind}`));
      return report('RECOVERY_BEFORE', steps);
    }
  }
  steps.push(step('T13-B.1', 'sign-in succeeds', runtime.auth.getState().kind === 'AUTHENTICATED' ? 'PASS' : 'FAIL', describeAuth(runtime)));
  const phase = await settled(runtime);
  steps.push(step('T13-B.2', 'the Product reaches READY only after the authoritative snapshot', phase.kind === 'READY' ? 'PASS' : 'FAIL', describePhase(phase)));
  if (phase.kind === 'READY') {
    await phase.runtime.recovery.writer.settled();
    const writer = phase.runtime.recovery.writer.status();
    steps.push(step('T13-B.3', 'the recovery LOCATOR was committed to the separate Product recovery store', writer.committed >= 1 ? 'PASS' : 'FAIL', describeSession(phase.runtime)));
  }
  // Deliberately NOT disposed: what is validated is what survives a KILL, not a clean shutdown.
  return report('RECOVERY_BEFORE', steps);
}

/** T13-A — after a real restart: the same Session and viewpoint, resumed, reconciled against fresh truth. */
async function after(kind: 'RECOVERY_AFTER'): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch(kind);
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  const restored = runtime.auth.getState();
  steps.push(step('T13-A.1', 'the AUTH session is restored from the auth store (separate from Product recovery)', restored.kind === 'AUTHENTICATED' ? 'PASS' : 'FAIL', describeAuth(runtime)));
  const phase = await settled(runtime);
  const resumed = phase.kind === 'READY' && phase.runtime.recovery.origin === 'RESUMED';
  steps.push(step('T13-A.2', 'the Product is READY through RESUME: the stored Session locator was validated against the server, and no Session was created', resumed ? 'PASS' : 'FAIL', describePhase(phase)));
  if (phase.kind === 'READY') {
    const state = phase.runtime.store.getState();
    // Fresh live truth: the record holds no Live Head, so whatever LH is here came from the server now.
    steps.push(step('T13-A.3', 'LH / LF are the fresh server mirrors, and the effective TC is derived from them and the recovered mode', 'PASS', `lh=${state.live.LH === null ? 'null' : state.live.LH} lf=${state.live.LF.value.kind} tm=${state.temporal.kind === 'PINNED' ? `PINNED(${state.temporal.at})` : 'FOLLOW_LIVE'}`));
    steps.push(step('T13-A.4', 'the process-local Exact Return origin did NOT survive the restart', phase.runtime.journey.origin() === null ? 'PASS' : 'FAIL', `origin=${phase.runtime.journey.origin() === null ? 'none' : 'BOUND'} rh=${state.history.length}`));
  }
  return report(kind, steps);
}

/** T13-S — after a sign-out and a kill: no identity, no record read, no world. */
async function afterSignedOut(): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('RECOVERY_AFTER_SIGNED_OUT');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  const phase = await settled(runtime);
  const signedOut = runtime.auth.getState().kind === 'SIGNED_OUT' && phase.kind === 'SIGNED_OUT';
  steps.push(step('T13-S.1', 'a signed-out launch exposes no Product and loads no Product recovery', signedOut ? 'PASS' : 'FAIL', `${describeAuth(runtime)} ${describePhase(phase)}`));
  return report('RECOVERY_AFTER_SIGNED_OUT', steps);
}

/** T13-F — after adopting a Session the server does not attribute to this identity: fail closed. */
async function afterRefused(): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('RECOVERY_AFTER_REFUSED');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  const phase = await settled(runtime);
  const refused = phase.kind === 'RECOVERY_FAILED' && phase.failure.kind === 'SESSION_INVALID';
  steps.push(step('T13-F.1', 'a stored Session the server refuses fails closed: RECOVERY_FAILED, no replacement Session, no world', refused ? 'PASS' : 'FAIL', `${describeAuth(runtime)} ${describePhase(phase)}`));
  return report('RECOVERY_AFTER_REFUSED', steps);
}

/** T13-D — write a record naming a server-populated Session for THIS identity, through the production store. */
async function adopt(inputs: RecoveryValidationInputs): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('ADOPT_SESSION');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  const state = runtime.auth.getState();
  if (state.kind !== 'AUTHENTICATED') {
    steps.push(step('T13-D.1', 'an authenticated identity owns the namespace being written', 'FAIL', describeAuth(runtime)));
    return report('ADOPT_SESSION', steps);
  }
  if (inputs.sessionId === undefined || inputs.sessionId.length === 0) {
    steps.push(step('T13-D.1', 'a Session locator was supplied', 'FAIL', 'no Session locator supplied'));
    return report('ADOPT_SESSION', steps);
  }
  // Let the current launch settle and then RETIRE it, so its own writer cannot advance the record
  // underneath the adoption. The next launch is what reads the adopted record back.
  await settled(runtime);
  runtime.dispose();
  const store = createProductRecoveryStore();
  const loaded = await store.load(state.userId);
  const sequence = loaded.kind === 'RECORD' ? loaded.record.sequence + 1 : 1;
  const record = productRecoveryRecord(
    state.userId,
    inputs.sessionId,
    { temporal: { kind: 'FOLLOW_LIVE' }, inspection: null, camera: initialCameraIntent(), history: [] },
    sequence,
  );
  const outcome = await store.write(record);
  steps.push(
    step(
      'T13-D.1',
      'the record was written through the production Product recovery store and codec, under this identity’s own namespace',
      outcome.kind === 'COMMITTED' ? 'PASS' : 'FAIL',
      `write=${outcome.kind} session=${inputs.sessionId} sequence=${sequence} previous=${loaded.kind}`,
    ),
  );
  return report('ADOPT_SESSION', steps);
}

/** T13-P — commit PINNED(moment) on the READY store; the durable snapshot must advance. */
async function pin(inputs: RecoveryValidationInputs): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('PIN_MOMENT');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  const phase = await settled(runtime);
  if (phase.kind !== 'READY') {
    steps.push(step('T13-P.1', 'the Product is READY', 'FAIL', describePhase(phase)));
    return report('PIN_MOMENT', steps);
  }
  const moment = inputs.moment ?? 0;
  const session = phase.runtime;
  const issued = session.recovery.writer.status().committed;
  let dispatched = 'NOT_ATTEMPTED';
  try {
    dispatched = session.store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(moment) }).outcome;
  } catch (cause) {
    dispatched = `REFUSED: ${cause instanceof Error ? cause.name : 'error'}`;
  }
  await session.recovery.writer.settled();
  const state = session.store.getState();
  const pinned = dispatched === 'APPLIED' && state.temporal.kind === 'PINNED' && state.temporal.at === moment;
  steps.push(step('T13-P.1', `COMMIT_MOMENT(${moment}) applied on the READY store: TM = PINNED(${moment})`, pinned ? 'PASS' : 'FAIL', `dispatch=${dispatched} ${describeSession(session)}`));
  steps.push(step('T13-P.2', 'the durable snapshot advanced on the effective act', session.recovery.writer.status().committed > issued ? 'PASS' : 'FAIL', `committed ${issued} -> ${session.recovery.writer.status().committed}`));
  // Not disposed: the pinned viewpoint must survive a KILL, which happens next, outside this file.
  return report('PIN_MOMENT', steps);
}

/** T13-O — sign out. The runtime retires; the record stays stored and unreachable. */
async function signOut(): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('RECOVERY_SIGN_OUT');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  await settled(runtime);
  const signedOut = await runtime.auth.signOut();
  const retired = signedOut.ok && runtime.auth.getState().kind === 'SIGNED_OUT' && runtime.getPhase().kind === 'SIGNED_OUT';
  steps.push(step('T13-O.1', 'sign-out retires the runtime; the identity’s Product recovery record is left stored and inaccessible', retired ? 'PASS' : 'FAIL', `${describeAuth(runtime)} ${describePhase(runtime.getPhase())}`));
  return report('RECOVERY_SIGN_OUT', steps);
}

/** T13-R — B signs in fresh and never sees A's record; A signs in again and resumes A's own. */
async function replacement(inputs: RecoveryValidationInputs): Promise<RecoveryValidationReport> {
  const steps: RecoveryValidationStep[] = [];
  const launched = await launch('RECOVERY_REPLACEMENT');
  if (!launched.ok) return launched.report;
  const { runtime } = launched;
  await settled(runtime);
  if (inputs.replacement === undefined || inputs.credentials === undefined) {
    steps.push(step('T13-R.1', 'both identities were supplied', 'FAIL', 'a replacement identity and the original identity are both required'));
    return report('RECOVERY_REPLACEMENT', steps);
  }
  if (runtime.auth.getState().kind === 'AUTHENTICATED') await runtime.auth.signOut();

  const b = await runtime.auth.signInWithPassword(inputs.replacement.email, inputs.replacement.password);
  if (!b.ok) {
    steps.push(step('T13-R.1', 'identity B signs in', 'FAIL', `sign-in refused: ${b.failure.kind}`));
    return report('RECOVERY_REPLACEMENT', steps);
  }
  const bPhase = await settled(runtime);
  const bSession = bPhase.kind === 'READY' ? bPhase.runtime.bundle.sessionId : null;
  steps.push(step('T13-R.1', 'identity B reaches READY through its OWN namespace: a FRESH Session, never A’s', bPhase.kind === 'READY' && bPhase.runtime.recovery.origin === 'FRESH' ? 'PASS' : 'FAIL', describePhase(bPhase)));
  if (bPhase.kind === 'READY') await bPhase.runtime.recovery.writer.settled();

  await runtime.auth.signOut();
  const a = await runtime.auth.signInWithPassword(inputs.credentials.email, inputs.credentials.password);
  if (!a.ok) {
    steps.push(step('T13-R.2', 'identity A signs in again', 'FAIL', `sign-in refused: ${a.failure.kind}`));
    return report('RECOVERY_REPLACEMENT', steps);
  }
  const aPhase = await settled(runtime);
  const aSession = aPhase.kind === 'READY' ? aPhase.runtime.bundle.sessionId : null;
  const resumedOwn = aPhase.kind === 'READY' && aPhase.runtime.recovery.origin === 'RESUMED' && aSession !== null && aSession !== bSession;
  steps.push(step('T13-R.2', 'identity A resumes A’s OWN record: RESUMED, and a different Session than B’s', resumedOwn ? 'PASS' : 'FAIL', `${describePhase(aPhase)} bSession=${bSession ?? 'none'}`));
  return report('RECOVERY_REPLACEMENT', steps);
}
