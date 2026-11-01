import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional,
  ServiceUnavailableException, UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TelemetryService } from '../../observability/telemetry.service';
import {
  DEFAULT_SPEECH_EXPRESSION, fromStoredHints, isSpeechExpression, MAX_SEGMENTS, PRODUCTION_RENDER_PROFILE, renderSpeech,
  SPEECH_RENDERER_VERSION, SPEECH_STYLE_SENTENCES, spokenAlignmentViolations, type StoredSpeechHint,
} from '../../speech-rendering';
import {
  ReplySpeechRepository, type ReplyEligibilityRefusal, type SpeechUsageForLedger, type StoredReplyHint,
} from '../../voice-media/reply-speech.repository';
import { SpeechAdmissionRefused } from '../speech-admission.guard';
import { collectSpeechPcm, SpeechSynthesisFailure, type SpeechSynthesisUsage } from '../speech-synthesis.adapter';
import { LISTEN_SYNTHESIS_ROUTE, type ListenSynthesisRoute } from './listen-synthesis.route';
import { pcmToWav, WAV_HEADER_BYTES } from './wav';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** Mirrors 0187 `reply_listen_policy_v1`: the store's per-segment audio ceiling. */
export const REPLY_SPEECH_MAX_AUDIO_BYTES = 3_145_728;
/** One segment's lease: two bounded attempts of the longest segment, the jitter and the database round trips. ≤ 120. */
export const REPLY_SPEECH_LEASE_SECONDS = 60;
/** §9.3: one retry at most (two attempts), each its own ledger row. */
const MAX_ATTEMPTS = 2;

export type SegmentState = 'READY' | 'IN_PROGRESS' | 'FAILED';
type Op = 'start' | 'synthesis' | 'audio' | 'cancel';
type Outcome = 'success' | 'replayed' | 'in_progress' | 'refused_expected' | 'overloaded' | 'provider_failure' | 'transport_failure';

const notFound = () => new NotFoundException({ outcome: 'NOT_FOUND' });

/**
 * S8B-04 (CP1, contract v1.2 §8) — «استمع» on a voice-note reply: creation (paid) separated from fetching (free).
 *
 *   start      free, idempotent: renders the reply's speech-only text, cuts it into segments and opens the listen
 *              (0187 replaces an earlier one; one listen per human).
 *   synthesis  the ONE paid command: per (listen, segment) the database admits ONE synthesis (the segment SYNTHESIZING and
 *              its ledger row PENDING, in one transaction); a repeat answers READY / IN_PROGRESS / FAILED, free. One
 *              retry, before any audio only, as its own ledger row; never a retry after audio started; never an automatic
 *              re-synthesis of an unknown result (a crash leaves the lease to the sweeper, which settles it unknown).
 *   audio      GET, from the 15-minute store only; never starts any provider work; repeatable for free.
 *   cancel     DELETE: the listen's segments are deleted (an in-flight one is discarded; its late audio is dropped).
 *
 * The reply text is read from its committed turn and never stored again; the spoken text is derived, checked against the
 * visible text (SPOKEN-ALIGN) and sent nowhere but the route. Nothing is logged; telemetry names classes only.
 */
@Injectable()
export class ReplyListenService {
  constructor(
    private readonly repository: ReplySpeechRepository,
    @Optional() @Inject(LISTEN_SYNTHESIS_ROUTE) private readonly route: ListenSynthesisRoute | null = null,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  async start(userId: string, turnId: string, body: unknown): Promise<{ listenId: string; segmentCount: number; expiresAt: string }> {
    const listenId = (body as { listenId?: unknown } | null)?.listenId;
    if (!UUID.test(turnId)) throw notFound();
    if (typeof listenId !== 'string' || !UUID.test(listenId)) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
    if (!this.route) return this.refuse('start', new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' }));
    const reply = await this.guarded('start', () => this.repository.readForListen(userId, turnId));
    if (reply.outcome !== 'ELIGIBLE') return this.refuse('start', eligibilityRefusal(reply.outcome));
    const segments = speechSegments(reply.content ?? '', reply.hints ?? []);
    if (typeof segments === 'string') return this.refuse('start', new UnprocessableEntityException({ outcome: segments }));
    const row = await this.guarded('start', () => this.repository.startListen(userId, turnId, listenId, segments.length, SPEECH_RENDERER_VERSION));
    switch (row.outcome) {
      case 'STARTED':
      case 'ALREADY_STARTED':
        this.signal('start', row.outcome === 'STARTED' ? 'success' : 'replayed');
        return { listenId, segmentCount: Number(row.segment_count), expiresAt: String(row.expires_at) };
      case 'LISTEN_CONFLICT':
        return this.refuse('start', new ConflictException({ outcome: 'LISTEN_CONFLICT' }));
      case 'EXPIRED':
        return this.refuse('start', new ConflictException({ outcome: 'LISTEN_EXPIRED' }));
      default:
        return this.refuse('start', eligibilityRefusal(row.outcome));
    }
  }

  async synthesize(userId: string, turnId: string, listenId: string, index: string): Promise<{ segmentIndex: number; state: SegmentState }> {
    const segmentIndex = segmentIndexOf(index);
    if (!UUID.test(turnId) || !UUID.test(listenId) || segmentIndex === null) throw notFound();
    const route = this.route;
    if (!route) return this.refuse('synthesis', new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' }));
    // The instance's slot is taken BEFORE the database admits, so a full queue or an open breaker writes nothing.
    let release: () => void;
    try {
      release = await route.admission.enter();
    } catch (error) {
      if (error instanceof SpeechAdmissionRefused) {
        this.signal('synthesis', 'overloaded');
        throw new ServiceUnavailableException({ outcome: 'OVERLOADED' });
      }
      throw error;
    }
    try {
      const callId = randomUUID();
      const admitted = await this.guarded('synthesis', () => this.repository.admitSynthesis(userId, listenId, segmentIndex, callId, route.model, REPLY_SPEECH_LEASE_SECONDS));
      switch (admitted.outcome) {
        case 'READY':
          this.signal('synthesis', 'replayed');
          return { segmentIndex, state: 'READY' };
        case 'IN_PROGRESS':
          this.signal('synthesis', 'in_progress');
          return { segmentIndex, state: 'IN_PROGRESS' };
        case 'FAILED':
          this.signal('synthesis', 'replayed');
          return { segmentIndex, state: 'FAILED' };
        case 'BUSY':
          return this.refuse('synthesis', new HttpException({ outcome: 'BUSY' }, HttpStatus.TOO_MANY_REQUESTS));
        case 'ADMITTED':
          break;
        default:
          return this.refuse('synthesis', eligibilityRefusal(admitted.outcome));
      }
      // The route's turn must be the listen's turn, and the listen must be of this renderer; otherwise nothing is sent.
      const segments = admitted.assistant_turn_id === turnId && admitted.renderer_version === SPEECH_RENDERER_VERSION
        ? speechSegments(admitted.content ?? '', admitted.hints ?? []) : 'LISTEN_MISMATCH';
      if (typeof segments === 'string' || segments.length !== admitted.segment_count) {
        await this.guarded('synthesis', () => this.repository.failSynthesis(userId, callId, 'CANCELLED_BEFORE_PROVIDER', 'ABSENT', {}, true));
        this.signal('synthesis', 'refused_expected');
        return { segmentIndex, state: 'FAILED' };
      }
      const expression = isSpeechExpression(admitted.expression) ? admitted.expression : DEFAULT_SPEECH_EXPRESSION;
      return await this.runAttempts(route, userId, listenId, segmentIndex, callId, segments[segmentIndex]!, SPEECH_STYLE_SENTENCES[expression].style);
    } finally {
      release();
    }
  }

  async audio(userId: string, turnId: string, listenId: string, index: string): Promise<Buffer> {
    const segmentIndex = segmentIndexOf(index);
    if (!UUID.test(turnId) || !UUID.test(listenId) || segmentIndex === null) throw notFound();
    const row = await this.guarded('audio', () => this.repository.readAudio(userId, listenId, segmentIndex));
    switch (row.outcome) {
      case 'READY':
        if (!row.audio || row.audio.length <= WAV_HEADER_BYTES) return this.refuse('audio', notFound());
        this.signal('audio', 'success');
        return row.audio;
      case 'IN_PROGRESS':
        this.signal('audio', 'in_progress');
        throw new ConflictException({ outcome: 'IN_PROGRESS' });
      case 'NOT_STARTED':
      case 'FAILED':
        return this.refuse('audio', new ConflictException({ outcome: row.outcome }));
      default:
        return this.refuse('audio', eligibilityRefusal(row.outcome));
    }
  }

  async cancel(userId: string, turnId: string, listenId: string): Promise<void> {
    if (!UUID.test(turnId) || !UUID.test(listenId)) throw notFound();
    await this.guarded('cancel', () => this.repository.cancelListen(userId, listenId));
    this.signal('cancel', 'success');
  }

  private async runAttempts(route: ListenSynthesisRoute, userId: string, listenId: string, segmentIndex: number, firstCall: string,
    text: string, style: string): Promise<{ segmentIndex: number; state: SegmentState }> {
    let callId = firstCall;
    for (let attempt = 1; ; attempt += 1) {
      let produced: { wav: Buffer; usage: SpeechSynthesisUsage };
      try {
        produced = await this.synthesizeOnce(route, text, style);
      } catch (error) {
        const failure = error instanceof SpeechSynthesisFailure ? error : new SpeechSynthesisFailure('MALFORMED', true, true);
        route.admission.recordFailure(failure);
        const outcome = failure.providerReached ? 'FAILED' : 'CANCELLED_BEFORE_PROVIDER';
        const retry = failure.retryable && attempt < MAX_ATTEMPTS;
        const failed = await this.guarded('synthesis', () => this.repository.failSynthesis(userId, callId, outcome, 'ABSENT', {}, !retry));
        if (retry && failed.outcome === 'RETRYABLE') {
          await new Promise((resolve) => setTimeout(resolve, route.retryDelayMs()));
          const next = randomUUID();
          const begun = await this.guarded('synthesis', () => this.repository.retrySynthesis(userId, listenId, segmentIndex, callId, next, route.model, REPLY_SPEECH_LEASE_SECONDS));
          if (begun.outcome === 'RETRY_BEGUN') {
            callId = next;
            continue;
          }
          // The retry was not allowed (the listen moved on meanwhile): the attempt already settled is made final.
          await this.guarded('synthesis', () => this.repository.failSynthesis(userId, callId, outcome, 'ABSENT', {}, true));
        }
        this.signal('synthesis', 'provider_failure');
        return { segmentIndex, state: 'FAILED' };
      }
      const done = await this.guarded('synthesis', () => this.repository.completeSynthesis(userId, callId, produced.wav, produced.usage.completeness, ledgerUsage(produced.usage)));
      if (done.outcome === 'READY') {
        this.signal('synthesis', 'success');
        return { segmentIndex, state: 'READY' };
      }
      // The listen was cancelled, replaced or expired while synthesizing: the call is settled, the audio dropped.
      return this.refuse('synthesis', new ConflictException({ outcome: 'LISTEN_GONE' }));
    }
  }

  private async synthesizeOnce(route: ListenSynthesisRoute, text: string, style: string): Promise<{ wav: Buffer; usage: SpeechSynthesisUsage }> {
    const controller = new AbortController();
    try {
      const session = route.adapter.synthesize({ text, voiceId: route.voiceId, hint: style, signal: controller.signal, timeoutMs: route.segmentTimeoutMs(text) });
      const { pcm, result } = await collectSpeechPcm(session, REPLY_SPEECH_MAX_AUDIO_BYTES - WAV_HEADER_BYTES);
      if (pcm.length === 0) throw new SpeechSynthesisFailure('EMPTY', false, true);
      return { wav: pcmToWav(pcm, result.pcmSampleRate ?? 24000), usage: result.usage };
    } finally {
      controller.abort();
    }
  }

  /** A database or transport failure: the paid state is the database's; nothing is guessed and the answer is 503. */
  private async guarded<T>(op: Op, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      this.signal(op, 'transport_failure');
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }

  private refuse(op: Op, error: HttpException): never {
    this.signal(op, 'refused_expected');
    throw error;
  }

  private signal(op: Op, outcome: Outcome): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LISTEN', op, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

/** The reply's spoken segments, or why it cannot be listened to. Pure; the same reply always gives the same segments. */
export function speechSegments(content: string, stored: readonly StoredReplyHint[]): readonly string[] | 'NOTHING_TO_SPEAK' | 'TOO_LONG_TO_LISTEN' | 'NOT_ALIGNED' {
  const hints = fromStoredHints(content, stored as readonly StoredSpeechHint[]);
  const rendered = renderSpeech(content, hints, PRODUCTION_RENDER_PROFILE);
  if (spokenAlignmentViolations(content, rendered).length > 0) return 'NOT_ALIGNED';
  if (rendered.segmentation.kind === 'EMPTY') return 'NOTHING_TO_SPEAK';
  if (rendered.segmentation.kind === 'TOO_LONG') return 'TOO_LONG_TO_LISTEN';
  return rendered.segmentation.segments;
}

function segmentIndexOf(raw: string): number | null {
  return /^(?:0|[1-9]\d?)$/u.test(raw) && Number(raw) < MAX_SEGMENTS ? Number(raw) : null;
}

function eligibilityRefusal(outcome: ReplyEligibilityRefusal | string): HttpException {
  switch (outcome) {
    case 'CONSENT_REQUIRED':
      return new ForbiddenException({ outcome: 'CONSENT_REQUIRED' });
    case 'NOT_AVAILABLE_NOW':
      return new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' });
    default:
      // NOT_FOUND, NOT_VOICE_REPLY and another human's turn are one answer.
      return notFound();
  }
}

/** The ledger's usage: the provider's counts, or nothing at all (ABSENT is unknown, never zero). */
function ledgerUsage(usage: SpeechSynthesisUsage): SpeechUsageForLedger {
  return usage.completeness === 'COMPLETE' ? { INPUT_TOKEN: usage.inputTokens, AUDIO_OUTPUT_TOKEN: usage.audioOutputTokens } : {};
}
