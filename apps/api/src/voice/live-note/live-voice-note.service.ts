import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { TelemetryService } from '../../observability/telemetry.service';
import { classifyVoiceNote, DEFAULT_ASR_BAND_THRESHOLDS, type AsrBandThresholds, type VoiceNoteBand } from '../asr-confidence/asr-confidence';
import type { RecognizedWord } from '../batch-transcription-jobs.port';
import type { FinalizableRecognitionSession, StreamingRecognitionEvent } from '../speech-recognition.adapter';

/**
 * S8B-04 (CP2, Fast Voice Path, the Product Owner's D-S1 decision of 2026-11-01) — transcription DURING a voice-note
 * recording: the phone streams 16 kHz mono PCM while it records the M4A; the server relays it to the realtime recognizer
 * (behind its adapter); at Send the transcript is finalized at once instead of waiting for a batch job.
 *
 * What it guarantees (D-S1 conditions):
 *   - nothing is opened, and so no audio reaches the provider, unless the database admits it: the person's CURRENT
 *     voice consent (the version that discloses this flow), the gate, the session, one live note at a time, and the
 *     provider-call ledger row - all in one definer call;
 *   - interim results are never kept; final words live only in this process until Send hands them to the acceptance of
 *     the recording (they are never written anywhere else, and never logged);
 *   - cancel, an idle phone, a lost chunk or a failed recognizer discard everything at once and settle the ledger row;
 *   - the M4A recording stays the record (30 days, S8B-03): the live transcript is adopted for it only when the audio
 *     the recognizer heard matches the recording's proven length and every chunk arrived in order, and only when the
 *     SAME classification rule as the batch path (classifyVoiceNote) gives HIGH or MEDIUM. Otherwise the recording is
 *     transcribed by the batch path exactly as today.
 *   - The flag VOICE_NOTE_LIVE_TRANSCRIPT is OFF unless set to ADOPT: realtime quality must be accepted first (the
 *     Product Owner's quality condition: negation, names, numbers, Egyptian Arabic).
 */
export const LIVE_VOICE_NOTE_STORE = Symbol('LIVE_VOICE_NOTE_STORE');
export const REALTIME_RECOGNITION = Symbol('REALTIME_RECOGNITION');
export const LIVE_VOICE_NOTE_SETTINGS = Symbol('LIVE_VOICE_NOTE_SETTINGS');

/** Read once at startup by the Voice module (from the realtime config); absent: OFF with the default thresholds. */
export interface LiveVoiceNoteSettings {
  readonly mode: LiveTranscriptMode;
  readonly thresholds: AsrBandThresholds;
}

export interface RealtimeRecognition {
  openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<FinalizableRecognitionSession>;
}

export type LiveVoiceNoteOpenOutcome = 'OPENED' | 'CONSENT_REQUIRED' | 'NOT_AVAILABLE_NOW' | 'SESSION_NOT_ACTIVE' | 'NOT_FOUND' | 'CAPACITY_FULL';

export interface LiveVoiceNoteStore {
  /** Admits the live note and begins its ledger row (PENDING), in one transaction. */
  open(input: { userId: string; sessionId: string; liveId: string; callId: string }): Promise<LiveVoiceNoteOpenOutcome>;
  /** Ends it and settles the ledger row with the audio the gateway sent (never a provider-billed claim). */
  close(input: { userId: string; liveId: string; state: 'FINISHED' | 'CANCELLED' | 'FAILED'; audioMs: number | null }): Promise<void>;
}

/** PCM 16 kHz mono s16le: 32 bytes per millisecond. */
export const LIVE_NOTE_BYTES_PER_MS = 32;
/** The recording's own ceiling (10 minutes + 1 s, S8B-03) in PCM bytes. */
export const LIVE_NOTE_MAX_BYTES = (10 * 60_000 + 1000) * LIVE_NOTE_BYTES_PER_MS;
export const LIVE_NOTE_MAX_CHUNK_BYTES = 64 * 1024;
/** A live note that receives nothing for this long is discarded (the phone left or crashed). */
export const LIVE_NOTE_IDLE_MS = 20_000;
/** At Send, chunks still in flight are awaited this long, then the transcript is unusable (never partial). */
export const LIVE_NOTE_SEND_WAIT_MS = 1500;
/** The recognizer's audio and the recording's proven duration may differ by this much (buffering at both ends). */
export const LIVE_NOTE_DURATION_TOLERANCE_MS = 1200;

export type LiveTranscriptMode = 'OFF' | 'ADOPT';

export type LiveTranscript =
  | {
    readonly kind: 'TRANSCRIBED';
    readonly text: string;
    readonly band: Exclude<VoiceNoteBand, 'LOW'>;
    readonly uncertainTokens: readonly string[];
    readonly audioMs: number;
    readonly transcriptSha256: string;
  }
  | { readonly kind: 'UNUSABLE'; readonly reason: LiveUnusableReason };

export type LiveUnusableReason = 'NOT_FOUND' | 'GAP' | 'TOO_LONG' | 'RECOGNIZER_FAILED' | 'MISSING_CHUNKS' | 'NO_SPEECH' | 'LOW_BAND' | 'DURATION_MISMATCH' | 'FINALIZE_TIMEOUT';

type Entry = {
  readonly userId: string;
  readonly sessionId: string;
  readonly liveId: string;
  readonly session: FinalizableRecognitionSession;
  readonly abort: AbortController;
  readonly words: RecognizedWord[];
  nextSeq: number;
  bytes: number;
  unusable: LiveUnusableReason | null;
  idle: ReturnType<typeof setTimeout>;
  readonly chunkWaiters: Set<() => void>;
  readonly consumed: Promise<void>;
  closed: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const notFound = () => new NotFoundException({ outcome: 'NOT_FOUND' });

@Injectable()
export class LiveVoiceNoteService {
  private readonly entries = new Map<string, Entry>();
  private readonly byUser = new Map<string, string>();
  private readonly mode: LiveTranscriptMode;
  private readonly thresholds: AsrBandThresholds;

  constructor(
    @Inject(LIVE_VOICE_NOTE_STORE) private readonly store: LiveVoiceNoteStore,
    @Optional() @Inject(REALTIME_RECOGNITION) private readonly recognizer?: RealtimeRecognition | null,
    @Optional() private readonly telemetry?: TelemetryService,
    @Optional() @Inject(LIVE_VOICE_NOTE_SETTINGS) settings?: LiveVoiceNoteSettings,
  ) {
    this.mode = settings?.mode ?? 'OFF';
    this.thresholds = settings?.thresholds ?? DEFAULT_ASR_BAND_THRESHOLDS;
  }

  /** Whether the phone should stream audio during recording at all. */
  get available(): boolean {
    return this.mode === 'ADOPT' && this.recognizer != null;
  }

  async open(userId: string, sessionId: string, liveId: string): Promise<{ outcome: 'OPENED' }> {
    if (!UUID.test(sessionId) || !UUID.test(liveId)) throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
    const recognizer = this.recognizer;
    if (!this.available || !recognizer) throw new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' });
    const existing = this.entries.get(liveId);
    if (existing) {
      if (existing.userId !== userId) throw notFound();
      return { outcome: 'OPENED' };
    }
    // One live note per human: an earlier one (a crashed or abandoned recording) is discarded first.
    const previous = this.byUser.get(userId);
    if (previous) await this.discard(previous, 'CANCELLED');
    const callId = randomUUID();
    let admitted: LiveVoiceNoteOpenOutcome;
    try {
      admitted = await this.store.open({ userId, sessionId, liveId, callId });
    } catch {
      this.signal('open', 'transport_failure');
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
    switch (admitted) {
      case 'OPENED':
        break;
      case 'CONSENT_REQUIRED':
        this.signal('open', 'refused_expected');
        throw new ForbiddenException({ outcome: 'CONSENT_REQUIRED' });
      case 'SESSION_NOT_ACTIVE':
        this.signal('open', 'refused_expected');
        throw new ConflictException({ outcome: 'SESSION_NOT_ACTIVE' });
      case 'NOT_AVAILABLE_NOW':
        this.signal('open', 'refused_expected');
        throw new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' });
      case 'CAPACITY_FULL':
        // S8B-05 (0189): every realtime seat is taken (calls and live notes together): the phone records without it.
        this.signal('open', 'refused_expected');
        throw new ServiceUnavailableException({ outcome: 'CAPACITY_FULL' });
      default:
        throw notFound();
    }
    const abort = new AbortController();
    let session: FinalizableRecognitionSession;
    try {
      session = await recognizer.openStream({ language: 'ar_en', signal: abort.signal });
    } catch {
      await this.store.close({ userId, liveId, state: 'FAILED', audioMs: null }).catch(() => undefined);
      this.signal('open', 'provider_failure');
      throw new ServiceUnavailableException({ outcome: 'NOT_AVAILABLE_NOW' });
    }
    const words: RecognizedWord[] = [];
    const entry: Entry = {
      userId, sessionId, liveId, session, abort, words, nextSeq: 0, bytes: 0, unusable: null, closed: false,
      idle: this.idleTimer(liveId),
      chunkWaiters: new Set(),
      consumed: Promise.resolve(),
    };
    (entry as { consumed: Promise<void> }).consumed = this.consume(entry, session.events);
    this.entries.set(liveId, entry);
    this.byUser.set(userId, liveId);
    this.signal('open', 'success');
    return { outcome: 'OPENED' };
  }

  /** One chunk, numbered from 0. A repeat is ignored; a gap makes the transcript unusable (the batch path then runs). */
  async append(userId: string, liveId: string, seq: number, chunk: Buffer): Promise<{ outcome: 'ACCEPTED' | 'DUPLICATE' | 'UNUSABLE' }> {
    const entry = this.owned(userId, liveId);
    if (!Number.isSafeInteger(seq) || seq < 0 || chunk.length === 0 || chunk.length > LIVE_NOTE_MAX_CHUNK_BYTES || chunk.length % 2 !== 0) {
      throw new BadRequestException({ outcome: 'INVALID_REQUEST' });
    }
    if (seq < entry.nextSeq) return { outcome: 'DUPLICATE' };
    if (entry.unusable) return { outcome: 'UNUSABLE' };
    if (seq > entry.nextSeq) return this.markUnusable(entry, 'GAP');
    if (entry.bytes + chunk.length > LIVE_NOTE_MAX_BYTES) return this.markUnusable(entry, 'TOO_LONG');
    entry.nextSeq += 1;
    entry.bytes += chunk.length;
    clearTimeout(entry.idle);
    entry.idle = this.idleTimer(liveId);
    for (const waiter of [...entry.chunkWaiters]) waiter();
    try {
      await entry.session.send(chunk);
    } catch {
      return this.markUnusable(entry, 'RECOGNIZER_FAILED');
    }
    return { outcome: 'ACCEPTED' };
  }

  /** The person cancelled the recording: everything is discarded, the ledger row settled. */
  async cancel(userId: string, liveId: string): Promise<void> {
    this.owned(userId, liveId);
    await this.discard(liveId, 'CANCELLED');
    this.signal('cancel', 'success');
  }

  /**
   * Send: waits for the chunks the phone says it sent, finalizes the recognizer at once, and classifies the whole note
   * by the batch rule. The words leave this service only in the answer; nothing is kept. `provenDurationMs` is the
   * recording's proven audio length (the M4A), compared with what the recognizer heard.
   */
  async finish(userId: string, liveId: string, sentChunks: number, provenDurationMs: Promise<number | null>): Promise<LiveTranscript> {
    const entry = this.entries.get(liveId);
    if (!entry || entry.userId !== userId) return { kind: 'UNUSABLE', reason: 'NOT_FOUND' };
    clearTimeout(entry.idle);
    const arrived = await this.awaitChunks(entry, sentChunks);
    if (entry.unusable) return this.close(entry, { kind: 'UNUSABLE', reason: entry.unusable });
    if (!arrived) return this.close(entry, { kind: 'UNUSABLE', reason: 'MISSING_CHUNKS' });
    try {
      // A finalize the provider never answered may lack the last words: the transcript is then unusable (never partial).
      if ((await entry.session.finalize()) === 'TIMED_OUT') return this.close(entry, { kind: 'UNUSABLE', reason: 'FINALIZE_TIMEOUT' });
    } catch {
      return this.close(entry, { kind: 'UNUSABLE', reason: 'RECOGNIZER_FAILED' });
    }
    // The finals arrived before finalize answered; the event queue hands them over on microtasks only, so one macrotask
    // turn guarantees every one of them reached `consume`.
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (entry.unusable) return this.close(entry, { kind: 'UNUSABLE', reason: entry.unusable });
    const audioMs = Math.round(entry.bytes / LIVE_NOTE_BYTES_PER_MS);
    const proven = await provenDurationMs.catch(() => null);
    if (proven === null || Math.abs(proven - audioMs) > LIVE_NOTE_DURATION_TOLERANCE_MS) {
      return this.close(entry, { kind: 'UNUSABLE', reason: 'DURATION_MISMATCH' });
    }
    const classified = classifyVoiceNote(entry.words, this.thresholds);
    if (classified.kind === 'NO_SPEECH') return this.close(entry, { kind: 'UNUSABLE', reason: 'NO_SPEECH' });
    if (classified.kind === 'TOO_LONG') return this.close(entry, { kind: 'UNUSABLE', reason: 'TOO_LONG' });
    if (classified.band === 'LOW') return this.close(entry, { kind: 'UNUSABLE', reason: 'LOW_BAND' });
    return this.close(entry, {
      kind: 'TRANSCRIBED', text: classified.text, band: classified.band, uncertainTokens: classified.uncertainTokens, audioMs,
      transcriptSha256: createHash('sha256').update(classified.text, 'utf8').digest('hex'),
    });
  }

  private idleTimer(liveId: string): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => void this.discard(liveId, 'CANCELLED'), LIVE_NOTE_IDLE_MS);
    timer.unref?.();
    return timer;
  }

  private owned(userId: string, liveId: string): Entry {
    if (!UUID.test(liveId)) throw notFound();
    const entry = this.entries.get(liveId);
    if (!entry || entry.userId !== userId) throw notFound();
    return entry;
  }

  private markUnusable(entry: Entry, reason: LiveUnusableReason): { outcome: 'UNUSABLE' } {
    entry.unusable ??= reason;
    // Nothing more is sent: the transcript can no longer be adopted, so further audio would be paid for nothing.
    entry.abort.abort();
    entry.session.abort();
    for (const waiter of [...entry.chunkWaiters]) waiter();
    this.signal('append', 'unusable');
    return { outcome: 'UNUSABLE' };
  }

  private async awaitChunks(entry: Entry, sentChunks: number): Promise<boolean> {
    if (!Number.isSafeInteger(sentChunks) || sentChunks < 0) return false;
    const deadline = Date.now() + LIVE_NOTE_SEND_WAIT_MS;
    while (entry.nextSeq < sentChunks && !entry.unusable) {
      const left = deadline - Date.now();
      if (left <= 0) return false;
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          entry.chunkWaiters.delete(done);
          resolve();
        };
        const timer = setTimeout(done, left);
        entry.chunkWaiters.add(done);
      });
    }
    return entry.nextSeq === sentChunks;
  }

  private async consume(entry: Entry, events: AsyncIterable<StreamingRecognitionEvent>): Promise<void> {
    try {
      for await (const event of events) {
        // Interim results are provisional and never kept.
        if (event.kind !== 'FINAL') continue;
        const words = (event.speech as { words?: readonly RecognizedWord[] }).words;
        if (words) entry.words.push(...words);
      }
    } catch {
      if (!entry.closed) entry.unusable ??= 'RECOGNIZER_FAILED';
    }
  }

  private close(entry: Entry, answer: LiveTranscript): LiveTranscript {
    const state = answer.kind === 'TRANSCRIBED' ? 'FINISHED' : entry.unusable === 'RECOGNIZER_FAILED' ? 'FAILED' : 'CANCELLED';
    this.forget(entry);
    // The session's end (and the ledger settlement) never delays Send: the transcript is already final.
    void (async () => {
      if (state === 'FINISHED') await entry.session.end().catch(() => undefined);
      else entry.session.abort();
      await this.store.close({ userId: entry.userId, liveId: entry.liveId, state, audioMs: Math.round(entry.bytes / LIVE_NOTE_BYTES_PER_MS) }).catch(() => this.signal('close', 'transport_failure'));
    })();
    entry.words.length = 0;
    this.signal('finish', answer.kind === 'TRANSCRIBED' ? 'success' : answer.reason.toLowerCase());
    return answer;
  }

  private async discard(liveId: string, state: 'CANCELLED' | 'FAILED'): Promise<void> {
    const entry = this.entries.get(liveId);
    if (!entry) return;
    this.forget(entry);
    entry.abort.abort();
    entry.session.abort();
    entry.words.length = 0;
    await this.store.close({ userId: entry.userId, liveId, state, audioMs: Math.round(entry.bytes / LIVE_NOTE_BYTES_PER_MS) }).catch(() => this.signal('close', 'transport_failure'));
  }

  private forget(entry: Entry): void {
    entry.closed = true;
    clearTimeout(entry.idle);
    this.entries.delete(entry.liveId);
    if (this.byUser.get(entry.userId) === entry.liveId) this.byUser.delete(entry.userId);
    for (const waiter of [...entry.chunkWaiters]) waiter();
  }

  private signal(op: string, outcome: string): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_LIVE_NOTE', op, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
