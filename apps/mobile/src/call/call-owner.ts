/**
 * S8B-06 CP3 — the ONE live call of a runtime generation, as the Product shows it: the in-memory owner above
 * DepthComposition (contract A6 06-CP3, v1.0 §§9–12, G1.2 / P4-C3).
 *
 * It owns no call rule of its own. The call is CP2's {@link LiveCallController} (the platform call, the engine and the
 * protocol session, one end latch), started here and read here; what this owner adds is only what the call UI needs:
 *
 *   - **Server truth.** The stage the UI shows is the server's (the latest STATE), the platform's (HELD) or the link's
 *     (RECONNECTING); never an animation's. A lost link is RECONNECTING, never an end; an end is shown only once the latch
 *     closed. Before a start, the server's call truth is read: a call the server still holds is never started twice.
 *   - **Navigation never touches the call.** The owner lives with the runtime generation, not with a screen: moving
 *     between the Conversation, the Analysis and the call line re-reads this state and opens nothing — no second socket,
 *     no second call, the engine untouched; mute, route and hold are the call's own and are shown as they are.
 *   - **Consent first.** A call needs the Voice Notes' recording consent (VOICE_RECORDING_V3); without it the same consent
 *     sheet opens, and its agreement starts the call.
 *   - **Typed during the call (D-05-07 T1).** A message sent while the call is up goes as TEXT_TURN on the call's channel
 *     (QANDEEL's voice stops at the send, not while typing), under a fresh `clientTurnId`, and joins the conversation as
 *     the server commits it. A message the call could not carry (it ended first) is written normally — but only once the
 *     server's call truth shows no call and the history shows the call did not commit it: never twice, never lost.
 *   - **The map follows.** Every committed turn and every reply's end asks the Analysis owners to catch up, and the
 *     conversation to read its newest page; the phone analyses nothing.
 *   - **J3 / J7.** An end the person did not choose says why (the approved notice) and sends the reader back to the
 *     Conversation, where writing is; a finished call leaves a record (its length, from the server's history when known).
 *
 * Nothing here logs, stores or inspects audio or words; nothing persists.
 */
import type { ChromeLanguage } from '../orientation-chrome/types';
import type {
  CallTruthRead,
  ConversationExchangeView,
  ConversationHistoryOutcome,
  ConversationSubmitOutcome,
  ConversationTurnSubmission,
} from '../runtime-entry';
import type { LiveCallClientEvent, LiveCallSocketFactory, LiveCallTimers } from '../voice-call/live-call-client';
import { LiveCallController, LiveCallStartError, type LiveCallControllerEvent, type LiveCallOutcome } from '../voice-call/live-call-controller';
import { liveCallSurfaceCopy, type LiveCallNotice } from '../voice-call/live-call-copy';
import type { CallPlatform, VoiceCallEngine } from '../voice-call/voice-call-engine';

export type CallStage = 'IDLE' | 'PREPARING' | 'CONNECTING' | 'ACTIVE' | 'HELD' | 'RECONNECTING' | 'ENDING';

/** J7: the finished call this generation saw end. Its length is the phone's own count from ACTIVE to the end (runtime only). */
export interface CallRecord {
  readonly callId: string;
  readonly lengthMs: number | null;
  /** The call ended without the person choosing it (the record's «توقفت»). Known only in this runtime. */
  readonly stopped: boolean;
}

export interface CallOwnerState {
  readonly stage: CallStage;
  readonly callId: string | null;
  /** The phone's clock when the server first said ACTIVE: the call time is counted from here. */
  readonly activeSince: number | null;
  readonly muted: boolean;
  /** The platform's route as it last reported it; null while unknown, or for a route the call line does not switch. */
  readonly route: 'LOUDSPEAKER' | 'EARPIECE' | null;
  /** QANDEEL's voice is being heard (the engine's heard marks), for the assistive status only. */
  readonly audible: boolean;
  /** The 60-minute warning due now (the engine's cue state), shown in the app as well as heard. */
  readonly warning: 'T5' | 'T1' | null;
  /** Why a call did not start, or ended without the person choosing it. Cleared by the next start or dismiss. */
  readonly notice: LiveCallNotice | null;
  readonly record: CallRecord | null;
  /** Counts the ends the person did not choose (J3): each one returns the reader to the Conversation. */
  readonly unchosenEnds: number;
}

export type CarriedTextOutcome = ConversationSubmitOutcome | { readonly kind: 'WRITE_NORMALLY' };

export interface CallOwner {
  getState(): CallOwnerState;
  subscribe(listener: () => void): () => void;
  /** The handset in the Conversation: the server's truth, the microphone, the consent, then the call. */
  start(): Promise<void>;
  end(): void;
  toggleMute(): void;
  toggleRoute(): void;
  dismissNotice(): void;
  /**
   * D-05-07: a message the composer sends. Null when no call is up (it is written normally); otherwise the call carries
   * it, and the answer is the conversation's ordinary outcome — or WRITE_NORMALLY once it is proven the call did not.
   */
  carryText(submission: ConversationTurnSubmission): Promise<CarriedTextOutcome> | null;
  retire(): void;
}

export interface CallOwnerOptions {
  readonly sessionId: string;
  readonly isCurrent: () => boolean;
  /** The platform call and the engine; null where the build has none (then the call is NOT_AVAILABLE). */
  readonly platform: CallPlatform | null;
  readonly engine: VoiceCallEngine | null;
  readonly connectUrl: string | null;
  /** The bearer of this identity, decided at each use (AC-01); null once the identity is replaced. */
  readonly authorization: () => Record<string, string> | null;
  readonly truth: () => Promise<CallTruthRead>;
  readonly readHistory: () => Promise<ConversationHistoryOutcome>;
  readonly consent: (start: () => Promise<void>) => Promise<'READY' | 'ASKED' | 'UNAVAILABLE'>;
  readonly requestMicrophone: () => Promise<boolean>;
  readonly language: () => ChromeLanguage;
  /** A turn of the call was committed, or a reply ended: the conversation reads its newest page, the Analysis catches up. */
  readonly onCallTurn: () => void;
  /** The call ended: what waited for it (attention) is read again. */
  readonly onCallEnded: () => void;
  readonly newId: () => string;
  readonly now?: () => number;
  readonly timers?: LiveCallTimers;
  /** Tests and the device proof only. */
  readonly socketFactory?: LiveCallSocketFactory;
  /** The device proof's local server only (the client still refuses anything but the loopback). */
  readonly insecureLoopbackForProof?: boolean;
  /** How long a written message waits for the server's truth after the call that should have carried it ended. */
  readonly settleAttempts?: number;
  readonly settleIntervalMs?: number;
}

/** The server's live-call key of a committed call turn (0190 / 0191): `live-call:<callId>:<commitId>`. */
export const LIVE_CALL_KEY_PREFIX = 'live-call:';
export const liveCallKey = (callId: string, commitId: string): string => `${LIVE_CALL_KEY_PREFIX}${callId}:${commitId}`;
export function callIdOfKey(key: string | null): string | null {
  if (key === null || !key.startsWith(LIVE_CALL_KEY_PREFIX)) return null;
  const rest = key.slice(LIVE_CALL_KEY_PREFIX.length);
  const colon = rest.indexOf(':');
  return colon > 0 ? rest.slice(0, colon) : null;
}

/** How often a typed message the connection dropped is sent again (same clientTurnId: the server commits it once). */
const TEXT_RESEND_LIMIT = 3;
/** The server's 60-minute bound (D-05-06): an end at or after it, said by the server, is the length limit. */
const MAX_LENGTH_MARGIN_MS = 60 * 60_000 - 15_000;
const TOKEN_CHECK_MS = 60_000;

const realTimers: LiveCallTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

interface CarriedText {
  readonly key: string;
  readonly clientTurnId: string;
  readonly content: string;
  readonly callId: string;
  msgId: number | null;
  resends: number;
  settled: boolean;
  promise: Promise<CarriedTextOutcome>;
  resolve: (outcome: CarriedTextOutcome) => void;
}

const IDLE_STATE: CallOwnerState = Object.freeze({
  stage: 'IDLE', callId: null, activeSince: null, muted: false, route: null, audible: false, warning: null, notice: null, record: null,
  unchosenEnds: 0,
});

function bearerToken(header: Record<string, string> | null): string {
  const value = header?.Authorization ?? header?.authorization ?? '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length) : '';
}

/** Why the call did not start, or why it ended; null when the person chose the end. */
export function noticeOf(outcome: LiveCallOutcome, activeForMs: number | null): { readonly notice: LiveCallNotice | null; readonly chosen: boolean } {
  const reason = String(outcome.reason);
  if (outcome.origin === 'START_FAILED') {
    if (reason === 'MIC_PERMISSION_DENIED') return { notice: 'MIC_PERMISSION', chosen: false };
    if (reason === 'ALREADY_IN_CALL') return { notice: 'ALREADY_IN_CALL', chosen: false };
    return { notice: 'NOT_AVAILABLE', chosen: false };
  }
  if (outcome.origin === 'PERSON') return { notice: null, chosen: true };
  if (outcome.origin === 'PLATFORM') {
    // The notification's End and the system's call UI are the person's own end; a lost microphone or a failure is not.
    if (outcome.platformSource === 'NOTIFICATION' || outcome.platformSource === 'SYSTEM') return { notice: null, chosen: true };
    if (outcome.platformSource === 'MICROPHONE') return { notice: 'MICROPHONE_LOST', chosen: false };
    return { notice: 'STOPPED', chosen: false };
  }
  switch (reason) {
    case 'USER_ENDED':
      return { notice: null, chosen: true };
    case 'CAPACITY_FULL':
      return { notice: 'CAPACITY', chosen: false };
    case 'OTHER_DEVICE':
      return { notice: 'OTHER_DEVICE', chosen: false };
    case 'ALREADY_IN_CALL':
      return { notice: 'ALREADY_IN_CALL', chosen: false };
    case 'CONSENT_REQUIRED':
      return { notice: 'CONSENT', chosen: false };
    case 'NOT_AVAILABLE_NOW':
    case 'NOT_SUPPORTED_YET':
    case 'UNAVAILABLE':
    case 'OVERLOADED':
      return { notice: activeForMs === null ? 'NOT_AVAILABLE' : 'STOPPED', chosen: false };
    case 'SERVER_ENDED':
      return { notice: activeForMs !== null && activeForMs >= MAX_LENGTH_MARGIN_MS ? 'MAX_LENGTH' : 'STOPPED', chosen: false };
    default:
      return { notice: 'STOPPED', chosen: false };
  }
}

export function createCallOwner(options: CallOwnerOptions): CallOwner {
  const timers = options.timers ?? realTimers;
  const now = options.now ?? (() => timers.now());
  const settleAttempts = options.settleAttempts ?? 10;
  const settleIntervalMs = options.settleIntervalMs ?? 1000;
  const listeners = new Set<() => void>();
  let state: CallOwnerState = IDLE_STATE;
  let retired = false;
  let preparing = false;
  let controller: LiveCallController | null = null;
  let route: CallOwnerState['route'] = null;
  let activeSince: number | null = null;
  let lastTokenCheck = 0;
  let lastToken = '';
  const texts = new Map<string, CarriedText>();
  /** Typed messages waiting for the server's ACTIVE (TEXT_TURN exists only in an ACTIVE call). */
  const waiting: CarriedText[] = [];

  const live = () => !retired && options.isCurrent();

  function publish(patch: Partial<CallOwnerState>): void {
    const next = { ...state, ...patch };
    const keys = Object.keys(next) as (keyof CallOwnerState)[];
    if (keys.every((key) => next[key] === state[key])) return;
    state = Object.freeze(next);
    for (const listener of Array.from(listeners)) listener();
  }

  function stageOf(): CallStage {
    if (controller === null || controller.phase === 'ENDED' || controller.phase === 'IDLE') return preparing ? 'PREPARING' : 'IDLE';
    if (controller.phase === 'ENDING') return 'ENDING';
    if (controller.isReconnecting) return 'RECONNECTING';
    if (controller.isHeld) return 'HELD';
    if (controller.session?.client.callState === 'ACTIVE') return 'ACTIVE';
    return 'CONNECTING';
  }

  function warningOf(): CallOwnerState['warning'] {
    if (controller === null) return null;
    const due = (kind: 'T5' | 'T1') => ['QUEUED', 'PLAYING', 'HEARD'].includes(controller!.warning.phase[kind]);
    return due('T1') ? 'T1' : due('T5') ? 'T5' : null;
  }

  function refresh(): void {
    if (!live()) return;
    const stage = stageOf();
    const running = controller !== null && stage !== 'IDLE' && stage !== 'PREPARING';
    publish({
      stage,
      callId: running ? currentCallId : null,
      activeSince: running ? activeSince : null,
      muted: running ? controller!.isMuted : false,
      route: running ? route : null,
      audible: running ? controller!.isQandeelAudible : false,
      warning: running ? warningOf() : null,
    });
  }

  let currentCallId: string | null = null;

  // ------------------------------------------------------------------ typed messages (D-05-07 T1)

  function exchangeOf(text: CarriedText, turnId: string): ConversationExchangeView {
    return {
      userTurn: { id: turnId, content: text.content, idempotencyKey: liveCallKey(text.callId, text.clientTurnId), createdAt: new Date(now()).toISOString() },
      replyState: 'PENDING',
      reply: null,
    };
  }

  function settle(text: CarriedText, outcome: CarriedTextOutcome): void {
    if (text.settled) return;
    text.settled = true;
    const index = waiting.indexOf(text);
    if (index >= 0) waiting.splice(index, 1);
    text.resolve(outcome);
  }

  function dispatch(text: CarriedText): void {
    if (text.settled) return;
    const msgId = controller !== null && currentCallId === text.callId ? controller.sendText(text.clientTurnId, text.content) : null;
    if (msgId !== null) {
      text.msgId = msgId;
      return;
    }
    // Not ACTIVE on the server yet (connecting), or the call is going: it waits for ACTIVE or for the end.
    if (!waiting.includes(text)) waiting.push(text);
  }

  async function findInHistory(text: CarriedText): Promise<ConversationExchangeView | null | 'UNREADABLE'> {
    const read = await options.readHistory();
    if (read.kind !== 'PAGE') return 'UNREADABLE';
    const key = liveCallKey(text.callId, text.clientTurnId);
    return read.page.exchanges.find((exchange) => exchange.userTurn.idempotencyKey === key) ?? null;
  }

  const pause = (ms: number) => new Promise<void>((resolve) => {
    timers.setTimeout(resolve, ms);
  });

  /**
   * The call that should have carried a message ended before it was committed. The server's truth decides: only once it
   * holds no call of this message's can the history say whether the call committed it; then it is either the call's turn
   * or written normally. While that cannot be established, the outcome is honestly unknown (the composer's "not confirmed").
   */
  async function settleAfterEnd(text: CarriedText): Promise<void> {
    for (let attempt = 0; attempt < settleAttempts && !text.settled; attempt += 1) {
      if (!live()) return;
      const truth = await options.truth();
      if (text.settled || !live()) return;
      if (truth.kind === 'NO_CALL_KNOWN' || (truth.kind === 'ACTIVE' && truth.callId !== text.callId)) {
        const found = await findInHistory(text);
        if (text.settled || !live()) return;
        if (found === 'UNREADABLE') break;
        settle(text, found === null ? { kind: 'WRITE_NORMALLY' } : { kind: 'ANSWERED', exchange: found });
        return;
      }
      await pause(settleIntervalMs);
    }
    settle(text, { kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' });
  }

  function textOfMsg(msgId: number): CarriedText | undefined {
    for (const text of texts.values()) if (!text.settled && text.msgId === msgId) return text;
    return undefined;
  }

  function onClient(event: LiveCallClientEvent): void {
    switch (event.type) {
      case 'state':
        if (event.message.state === 'ACTIVE') {
          // QAN-BL-VOICE-06 (2): a resumed connection gets no REPLY_END for the exchange the older one left open, and a
          // turn it drained is kept unanswered; the thread and the Analysis learn both from the history, read now.
          if (activeSince !== null) options.onCallTurn();
          activeSince ??= now();
          // After the client's own resume replay (it runs right after this event, from the same log): what waited goes
          // out once, behind what the log resends, never written a second time by that replay.
          if (waiting.length > 0) void Promise.resolve().then(() => {
            if (live()) for (const text of waiting.splice(0)) dispatch(text);
          });
        }
        return;
      case 'turnCommitted': {
        const { clientTurnId, role, turnId } = event.message;
        if (role === 'USER' && clientTurnId !== null) {
          const text = Array.from(texts.values()).find((candidate) => candidate.clientTurnId === clientTurnId && !candidate.settled);
          if (text) settle(text, { kind: 'ANSWERED', exchange: exchangeOf(text, turnId) });
        }
        options.onCallTurn();
        return;
      }
      case 'replyEnd':
        options.onCallTurn();
        return;
      case 'ack': {
        // A resend's ACK can arrive without its TURN_COMMITTED (that went out on the connection that was lost).
        const text = textOfMsg(event.msgId);
        if (text) {
          void findInHistory(text).then((found) => {
            if (found !== null && found !== 'UNREADABLE' && live()) settle(text, { kind: 'ANSWERED', exchange: found });
          });
        }
        return;
      }
      case 'refused': {
        if (event.msgId === null) return;
        const text = textOfMsg(event.msgId);
        if (!text) return;
        text.msgId = null;
        // UNAVAILABLE: the connection that held it went (the server refuses what was still waiting); it is sent again
        // after the resume, under the same clientTurnId. Anything else is the server's no: nothing was committed.
        if (event.reason === 'UNAVAILABLE' && text.resends < TEXT_RESEND_LIMIT && controller !== null && controller.phase === 'ACTIVE') {
          text.resends += 1;
          waiting.push(text);
          return;
        }
        settle(text, { kind: 'REFUSED', status: 409 });
        return;
      }
      default:
    }
  }

  function checkToken(): void {
    const at = now();
    if (at - lastTokenCheck < TOKEN_CHECK_MS) return;
    lastTokenCheck = at;
    const token = bearerToken(options.authorization());
    if (token.length === 0 || token === lastToken || controller?.phase !== 'ACTIVE') return;
    lastToken = token;
    controller.session?.client.refreshToken(token);
  }

  function onEvent(event: LiveCallControllerEvent): void {
    if (!live()) return;
    switch (event.type) {
      case 'session':
        if (event.event.source === 'client') onClient(event.event.event);
        checkToken();
        break;
      case 'platform': {
        const platform = event.event;
        if (platform.type === 'ENDPOINT') {
          route = platform.endpoint.type === 'SPEAKER' ? 'LOUDSPEAKER' : platform.endpoint.type === 'EARPIECE' ? 'EARPIECE' : null;
        }
        break;
      }
      case 'ended':
        onEnded(event.outcome);
        return;
      default:
    }
    refresh();
  }

  function onEnded(outcome: LiveCallOutcome): void {
    const endedId = currentCallId;
    const since = activeSince;
    const activeForMs = since === null ? null : now() - since;
    const { notice, chosen } = noticeOf(outcome, activeForMs);
    controller = null;
    currentCallId = null;
    activeSince = null;
    route = null;
    preparing = false;
    for (const text of waiting.splice(0)) void settleAfterEnd(text);
    for (const text of texts.values()) if (!text.settled && text.msgId !== null) void settleAfterEnd(text);
    publish({
      ...IDLE_STATE,
      notice,
      // A call that never became ACTIVE leaves no record: nothing of it was a call.
      record: endedId !== null && since !== null ? { callId: endedId, lengthMs: activeForMs, stopped: !chosen } : state.record,
      unchosenEnds: chosen ? state.unchosenEnds : state.unchosenEnds + 1,
    });
    options.onCallEnded();
    options.onCallTurn();
  }

  async function begin(): Promise<void> {
    if (!live() || controller !== null) return;
    const { platform, engine, connectUrl } = options;
    if (platform === null || engine === null || connectUrl === null) {
      preparing = false;
      publish({ stage: 'IDLE', notice: 'NOT_AVAILABLE', unchosenEnds: state.unchosenEnds + 1 });
      return;
    }
    const callId = options.newId();
    currentCallId = callId;
    lastToken = bearerToken(options.authorization());
    lastTokenCheck = now();
    controller = new LiveCallController({
      platform,
      engine,
      session: {
        url: connectUrl,
        accessToken: () => bearerToken(options.authorization()),
        callId,
        sessionId: options.sessionId,
        clientInstanceId: options.newId(),
        socketFactory: options.socketFactory,
        insecureLoopbackForProof: options.insecureLoopbackForProof === true,
      },
      // G1.2: the call starts on the loudspeaker (CANDIDATE J4); the platform owns the route from then on.
      engineOptions: { route: 'SPEAKER', capture: 'VOICE_COMMUNICATION', aec: true, bargeIn: 'STOP' },
      copy: liveCallSurfaceCopy(options.language()),
      timers: options.timers,
      onEvent,
    });
    route = 'LOUDSPEAKER';
    preparing = false;
    refresh();
    try {
      await controller.start();
    } catch (error) {
      if (!(error instanceof LiveCallStartError)) throw error;
      // The latch already closed with the refusal (START_FAILED); `ended` set the notice.
    }
    refresh();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (!live() || controller !== null || preparing) return;
      preparing = true;
      publish({ stage: 'PREPARING', notice: null });
      const stop = (notice: LiveCallNotice | null) => {
        preparing = false;
        if (live()) publish({ stage: 'IDLE', notice, unchosenEnds: notice === null ? state.unchosenEnds : state.unchosenEnds + 1 });
      };
      if (options.platform === null || options.engine === null || options.connectUrl === null) return stop('NOT_AVAILABLE');
      const capability = options.platform.capability();
      if (!capability.supported) return stop('NOT_AVAILABLE');
      if (capability.inCall) return stop('ALREADY_IN_CALL');
      // The server is asked first: a call it still holds (this phone's, before a restart, or another device's) is not
      // started twice. An unreadable truth starts nothing either way: the call authority itself refuses a second call.
      const truth = await options.truth();
      if (!live()) return;
      if (truth.kind === 'ACTIVE') return stop('ALREADY_IN_CALL');
      if (!capability.microphoneGranted && !(await options.requestMicrophone())) return stop('MIC_PERMISSION');
      if (!live()) return;
      const consent = await options.consent(begin);
      if (!live()) return;
      if (consent === 'READY') return begin();
      // ASKED: the consent sheet is open; its agreement starts the call. UNAVAILABLE: nothing to vouch for.
      return stop(consent === 'ASKED' ? null : 'NOT_AVAILABLE');
    },
    end() {
      controller?.end();
      refresh();
    },
    toggleMute() {
      if (controller === null) return;
      controller.setMuted(!controller.isMuted);
      refresh();
    },
    toggleRoute() {
      if (controller === null || route === null) return;
      controller.requestRoute(route === 'LOUDSPEAKER' ? 'EARPIECE' : 'SPEAKER');
    },
    dismissNotice() {
      publish({ notice: null });
    },
    carryText(submission) {
      if (!live()) return null;
      const known = texts.get(submission.idempotencyKey);
      if (known !== undefined) {
        if (!known.settled) return known.promise;
        // The composer's retry of a message the call took: settled again by the same truth, never sent a second way.
        const again = carried(known.key, known.clientTurnId, known.content, known.callId);
        if (controller !== null && currentCallId === known.callId) dispatch(again);
        else void settleAfterEnd(again);
        return again.promise;
      }
      if (controller === null || currentCallId === null || controller.phase === 'ENDING' || controller.phase === 'ENDED') return null;
      const text = carried(submission.idempotencyKey, options.newId(), submission.content, currentCallId);
      dispatch(text);
      return text.promise;
    },
    retire() {
      if (retired) return;
      // The generation is going (a sign-out, an identity replacement): its call goes with it.
      controller?.end();
      retired = true;
      listeners.clear();
    },
  };

  function carried(key: string, clientTurnId: string, content: string, callId: string): CarriedText {
    let resolve!: (outcome: CarriedTextOutcome) => void;
    const promise = new Promise<CarriedTextOutcome>((r) => {
      resolve = r;
    });
    const text: CarriedText = { key, clientTurnId, content, callId, msgId: null, resends: 0, settled: false, promise, resolve };
    texts.set(key, text);
    return text;
  }
}
