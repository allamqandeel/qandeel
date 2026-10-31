import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { VoiceMediaService } from '../voice-media/voice-media.service';
import {
  type ClaimedNoteRow,
  type LedgerSettlement,
  type ProviderDeletionReport,
  type UnsettledAttemptRow,
  VoiceNotesRepository,
} from '../voice-media/voice-notes.repository';
import { classifyVoiceNote, DEFAULT_ASR_BAND_THRESHOLDS, type AsrBandThresholds } from './asr-confidence/asr-confidence';
import {
  BATCH_TRANSCRIPTION_JOBS,
  type BatchFailure,
  type BatchTranscriptionJobs,
  type ProviderJobId,
  type RemovalOutcome,
} from './batch-transcription-jobs.port';
import { proveM4aAudioDuration } from './m4a/m4a-audio-duration';

/** The worker's settings, built once by `voice.module.ts` from the speechmatics configuration (no environment here). */
export interface VoiceNoteTranscriptionWorkerSettings {
  readonly enabled: boolean;
  readonly concurrency: number;
  readonly thresholds: AsrBandThresholds;
  readonly pollMs?: number;
}
export const VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS = Symbol('VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS');

/** Time, injectable so the specs run the poll and the quarantine on a fake clock. */
export interface VoiceWorkerClock {
  now(): number;
  wait(ms: number, signal: AbortSignal): Promise<void>;
}
export const VOICE_WORKER_CLOCK = Symbol('VOICE_WORKER_CLOCK');

const systemClock: VoiceWorkerClock = {
  now: () => Date.now(),
  wait: (ms, signal) => new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    timer.unref();
    function done() {
      signal.removeEventListener('abort', done);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  }),
};

/** §4.10.4 / §4.10.5 / §4.6 — the bounds of one attempt. The attempt LIMITS are the database's policy, never these. */
export const VOICE_WORKER_LIMITS = Object.freeze({
  leaseSeconds: 120,
  callMs: 10_000,
  submitBaseMs: 60_000,
  submitBytesPerSecond: 64 * 1024,
  submitMaxMs: 8 * 60_000,
  pollFirstMs: 2_000,
  pollMaxMs: 30_000,
  pollTotalMs: 15 * 60_000,
  unknownQuarantineMs: 30 * 60_000,
  deletionsPerSweep: 20,
  settlementGraceSeconds: 15 * 60,
  settlementsPerSweep: 20,
});

const FAILURE_CLASS: Record<BatchFailure, string> = {
  RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  NETWORK: 'PROVIDER_NETWORK',
  UNSUPPORTED_AUDIO: 'PROVIDER_UNSUPPORTED_AUDIO',
  CONFIG_REJECTED: 'PROVIDER_CONFIG_REJECTED',
  TOO_LARGE: 'PROVIDER_TOO_LARGE',
  AUTH: 'PROVIDER_AUTH',
};

const REMOVAL_REPORT: Record<RemovalOutcome['kind'], ProviderDeletionReport> = {
  REQUESTED: 'REQUESTED', ABSENT: 'ABSENT', LOCKED: 'LOCKED', TRANSIENT: 'TRANSIENT',
};

type Telemetry = 'success' | 'refused_expected' | 'retry_expected' | 'deferred' | 'transport_failure' | 'integrity_failure';

/**
 * S8B-03 (CP1, §4.3 / §4.6 / §4.7 / §4.8 / §4.10) — the Voice Note transcription worker and its provider deletion sweeper.
 *
 * It holds NO durable state: every step is a database transition first (0186), and a crash at any point resumes from the
 * last recorded fact when the lease ends (A6). The database owns the gate, consent, ownership, the attempt bounds (3
 * automatic, 5 in all), the quarantine and the deletion schedule; this worker only performs the external calls between
 * those transitions, through the batch jobs PORT (never a provider SDK, never the network directly).
 *
 *   PENDING           prove the duration locally (§4.6.2; a refusal never calls the provider) → begin (SUBMITTING, the
 *                     ledger row) → submit → CREATED | NOT_SENT | REJECTED | UNKNOWN, each recorded before anything else
 *   IN_PROGRESS       a SUBMITTED attempt is polled again (never re-submitted); an OUTCOME_UNKNOWN one is reconciled by
 *                     reference when that is enabled, else closed UNCERTAIN_SUBMISSION after the quarantine (no automatic
 *                     re-submission)
 *   DELETION_PENDING  only the first removal of each known job, recorded
 *
 * Every poll round renews the lease, which re-reads consent: a withdrawal holds the note (no text kept) and deletes the
 * job. Off under tests and whenever the server key or the media store is not configured. Nothing here logs; telemetry
 * carries outcome classes only (`VOICE_TRANSCRIPTION`), never a person, recording, job, key, transcript or word.
 */
@Injectable()
export class VoiceNoteTranscriptionWorker implements OnModuleInit, OnModuleDestroy {
  readonly workerId = `voice-note-worker:${randomUUID()}`;
  private readonly shutdown = new AbortController();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly clock: VoiceWorkerClock;

  constructor(
    private readonly notes: VoiceNotesRepository,
    private readonly media: VoiceMediaService,
    @Inject(VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS) private readonly settings: VoiceNoteTranscriptionWorkerSettings,
    @Optional() @Inject(BATCH_TRANSCRIPTION_JOBS) private readonly jobs: BatchTranscriptionJobs | null = null,
    @Optional() private readonly telemetry?: TelemetryService,
    @Optional() @Inject(VOICE_WORKER_CLOCK) clock?: VoiceWorkerClock,
  ) {
    this.clock = clock ?? systemClock;
  }

  get enabled(): boolean {
    return this.settings.enabled && this.jobs !== null;
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    const poll = Math.max(1000, this.settings.pollMs ?? 5000);
    this.timer = setInterval(() => void this.runOnce(), poll);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Ends the calls in flight only: nothing durable changes, and the leases end so another worker resumes (§4.10.5).
    this.shutdown.abort();
  }

  /** One cycle: claim up to `concurrency` notes and work them, then sweep the deletions due and the unsettled ledger rows. Never throws. */
  async runOnce(): Promise<{ claimed: number; deletions: number; settlements: number }> {
    const result = { claimed: 0, deletions: 0, settlements: 0 };
    if (this.running || this.jobs === null) return result;
    this.running = true;
    try {
      let rows: ClaimedNoteRow[] = [];
      try {
        rows = await this.notes.claim(this.workerId, VOICE_WORKER_LIMITS.leaseSeconds, Math.min(4, Math.max(1, this.settings.concurrency)));
        this.signal('claim', 'success');
      } catch {
        this.signal('claim', 'transport_failure');
      }
      result.claimed = rows.length;
      await Promise.all(rows.map((row) => this.work(row)));
      result.deletions = await this.sweepDeletions();
      result.settlements = await this.recoverSettlements();
    } finally {
      this.running = false;
    }
    return result;
  }

  /** One claimed note, to its next durable fact. A fault leaves the lease to end; the next claim resumes. */
  async work(row: ClaimedNoteRow): Promise<void> {
    try {
      await this.removeKnownJobs(row);
      if (row.state === 'DELETION_PENDING') return;
      if (row.state === 'PENDING') return await this.attempt(row);
      if (row.attempt_id !== null && row.attempt_state === 'SUBMITTED' && row.provider_job_id !== null) {
        return await this.follow(row, row.attempt_id, row.provider_job_id as ProviderJobId);
      }
      if (row.attempt_id !== null && row.attempt_state === 'OUTCOME_UNKNOWN') return await this.reconcile(row, row.attempt_id);
      await this.release(row);
    } catch {
      // A transport fault or a refused transition: the durable state is whatever was last recorded, never guessed.
      this.signal('attempt', 'transport_failure');
    }
  }

  // ------------------------------------------------------------------------------------------------ a new attempt
  private async attempt(row: ClaimedNoteRow): Promise<void> {
    const jobs = this.jobs as BatchTranscriptionJobs;
    const byteSize = Number(row.byte_size);
    const proofSignal = this.callSignal(VOICE_WORKER_LIMITS.callMs * 3);
    let proof;
    try {
      proof = await proveM4aAudioDuration(async (offset, length) => {
        const bytes = await this.media.readNoteRange(row.user_id, row.recording_id, offset, length, proofSignal);
        if (bytes === null) throw new NoteNotReadable();
        return bytes;
      }, byteSize);
    } catch (error) {
      // Not readable any more (deleted, expired, erased): the claim or begin cancels it. A store fault defers it.
      await this.notes.recordFailure(row.recording_id, this.workerId, null, 'STORAGE_UNAVAILABLE');
      this.signal('attempt', error instanceof NoteNotReadable ? 'refused_expected' : 'deferred');
      return;
    }
    if (proof.kind === 'REJECTED') {
      // §4.6 rule 2 / rule 8: final, with its class, and the provider is never called (A7: submit = 0, no attempt).
      await this.notes.recordFailure(row.recording_id, this.workerId, null, proof.rejection);
      this.signal('attempt', 'refused_expected');
      return;
    }
    const attemptId = randomUUID();
    const begun = await this.notes.beginSubmission(row.recording_id, this.workerId, attemptId, proof.durationMs);
    if (begun?.outcome !== 'SUBMITTING') {
      this.signal('attempt', 'refused_expected');
      return;
    }
    const submitSignal = this.callSignal(Math.min(VOICE_WORKER_LIMITS.submitMaxMs,
      VOICE_WORKER_LIMITS.submitBaseMs + Math.ceil((byteSize / VOICE_WORKER_LIMITS.submitBytesPerSecond) * 1000)));
    let outcome;
    try {
      const opened = await this.media.openNoteForTranscription(row.user_id, row.recording_id, submitSignal);
      if (opened === null) {
        // Deleted between the proof and the submission: nothing was sent.
        await this.closeAttempt(row, attemptId, 'STORAGE_UNAVAILABLE', { outcome: 'CANCELLED_BEFORE_PROVIDER' });
        return;
      }
      outcome = await jobs.submit({ audio: opened.audio, byteSize: opened.byteSize, contentType: 'audio/mp4', language: 'ar_en', reference: attemptId, signal: submitSignal });
    } catch {
      // The store failed before the adapter took a byte, or the adapter faulted: a byte may have left, so UNKNOWN.
      outcome = { kind: 'UNKNOWN' as const };
    }
    if (outcome.kind === 'CREATED') {
      await this.notes.recordSubmission(attemptId, 'CREATED', outcome.jobId);
      return this.follow({ ...row, duration_ms: proof.durationMs }, attemptId, outcome.jobId);
    }
    if (outcome.kind === 'NOT_SENT') {
      await this.closeAttempt(row, attemptId, FAILURE_CLASS[outcome.failure], { outcome: 'CANCELLED_BEFORE_PROVIDER' });
      return;
    }
    if (outcome.kind === 'REJECTED') {
      await this.closeAttempt(row, attemptId, FAILURE_CLASS[outcome.failure], { outcome: 'FAILED' });
      return;
    }
    // §4.6 rule 5: bytes may have left. Recorded as OUTCOME_UNKNOWN and never treated as "not created" (A8).
    await this.notes.recordSubmission(attemptId, 'UNKNOWN', null);
    this.signal('attempt', 'deferred');
    await this.reconcile(row, attemptId, true);
  }

  // ------------------------------------------------------------------------------------------------ an unknown outcome
  private async reconcile(row: ClaimedNoteRow, attemptId: string, justRecorded = false): Promise<void> {
    const jobs = this.jobs as BatchTranscriptionJobs;
    let found;
    try {
      found = await jobs.findByReference(attemptId, this.callSignal(VOICE_WORKER_LIMITS.callMs));
    } catch {
      found = { kind: 'TRANSIENT' as const };
    }
    if (found.kind === 'FOUND') {
      // Adopted: the job that the unknown submission created is completed and deleted like any other (A8).
      const adopted = await this.notes.recordSubmission(attemptId, 'CREATED', found.jobId);
      if (adopted?.outcome === 'RECORDED' || adopted?.outcome === 'ALREADY_RECORDED') return this.follow(row, attemptId, found.jobId);
      if (adopted?.outcome === 'RECORDED_FOR_DELETION') await this.removeJob(attemptId, found.jobId);
      return;
    }
    if (found.kind === 'NOT_FOUND_IN_COMPLETE_LISTING') {
      await this.closeAttempt(row, attemptId, 'NOT_CREATED', { outcome: 'FAILED' });
      return;
    }
    // Not reconcilable now (unsupported, or a transient listing). No automatic re-submission: after the quarantine the
    // attempt closes UNCERTAIN_SUBMISSION (UNKNOWN_JOB) and the note waits for the owner's explicit retry.
    const since = row.unknown_since !== null && !justRecorded ? Date.parse(row.unknown_since) : this.clock.now();
    if (this.clock.now() >= since + VOICE_WORKER_LIMITS.unknownQuarantineMs) {
      try {
        await this.closeAttempt(row, attemptId, 'UNCERTAIN_SUBMISSION', { outcome: 'FAILED' });
        return;
      } catch {
        // 55000: the database's quarantine has not ended yet; the next claim after it closes the attempt.
      }
    }
    await this.release(row);
  }

  // ------------------------------------------------------------------------------------------------ a created job
  private async follow(row: ClaimedNoteRow, attemptId: string, jobId: ProviderJobId): Promise<void> {
    const jobs = this.jobs as BatchTranscriptionJobs;
    const startedAt = this.clock.now();
    let delay: number = VOICE_WORKER_LIMITS.pollFirstMs;
    for (;;) {
      const lease = await this.notes.renewLease(row.recording_id, this.workerId, VOICE_WORKER_LIMITS.leaseSeconds);
      if (lease?.outcome === 'CONSENT_WITHDRAWN') {
        // §4.7: no text is kept; the job is deleted; the note is held until consent is current again.
        await this.notes.holdForConsent(row.recording_id);
        await this.settle(attemptId, row.user_id, { outcome: 'FAILED' });
        await this.removeJob(attemptId, jobId);
        this.signal('attempt', 'refused_expected');
        return;
      }
      if (lease?.outcome === 'CANCELLED') {
        // Deleted, expired or erased while transcribing: the attempt is CANCELLED in the database; the job is deleted.
        await this.settle(attemptId, row.user_id, { outcome: 'FAILED' });
        await this.removeJob(attemptId, jobId);
        this.signal('attempt', 'refused_expected');
        return;
      }
      if (lease?.outcome !== 'RENEWED') return; // Another worker holds the note now.

      let status;
      try {
        status = await jobs.status(jobId, this.callSignal(VOICE_WORKER_LIMITS.callMs));
      } catch {
        status = { kind: 'TRANSIENT' as const, failure: 'NETWORK' as const };
      }
      if (status.kind === 'DONE') return this.complete(row, attemptId, jobId);
      if (status.kind === 'FAILED') {
        await this.closeAttempt(row, attemptId, FAILURE_CLASS[status.failure], { outcome: 'FAILED' });
        await this.removeJob(attemptId, jobId);
        return;
      }
      if (status.kind === 'ABSENT') {
        await this.closeAttempt(row, attemptId, 'PROVIDER_UNAVAILABLE', { outcome: 'FAILED' });
        await this.recordDeletion(attemptId, 'ABSENT');
        return;
      }
      if (this.shutdown.signal.aborted) return;
      if (this.clock.now() - startedAt >= VOICE_WORKER_LIMITS.pollTotalMs) {
        await this.closeAttempt(row, attemptId, 'POLL_TIMEOUT', { outcome: 'FAILED' });
        await this.removeJob(attemptId, jobId);
        return;
      }
      await this.clock.wait(delay, this.shutdown.signal);
      delay = Math.min(VOICE_WORKER_LIMITS.pollMaxMs, delay * 2);
    }
  }

  private async complete(row: ClaimedNoteRow, attemptId: string, jobId: ProviderJobId): Promise<void> {
    const jobs = this.jobs as BatchTranscriptionJobs;
    let fetched;
    try {
      fetched = await jobs.fetchResult(jobId, this.callSignal(VOICE_WORKER_LIMITS.callMs));
    } catch {
      fetched = { kind: 'TRANSIENT' as const, failure: 'NETWORK' as const };
    }
    if (fetched.kind === 'TRANSIENT') {
      // The job is DONE and stays SUBMITTED: the next claim fetches it again (never re-submitted).
      await this.release(row);
      return;
    }
    if (fetched.kind === 'ABSENT') {
      await this.closeAttempt(row, attemptId, 'PROVIDER_UNAVAILABLE', { outcome: 'FAILED' });
      await this.recordDeletion(attemptId, 'ABSENT');
      return;
    }
    if (fetched.kind === 'MALFORMED') {
      await this.closeAttempt(row, attemptId, 'PROVIDER_RESULT_MALFORMED', { outcome: 'FAILED' });
      await this.removeJob(attemptId, jobId);
      return;
    }
    const classified = classifyVoiceNote(fetched.words, this.settings.thresholds ?? DEFAULT_ASR_BAND_THRESHOLDS);
    const usage: LedgerSettlement = fetched.providerDurationMs !== null
      ? { outcome: 'SUCCEEDED', audioInputMs: fetched.providerDurationMs, source: 'PROVIDER_REPORTED' }
      : { outcome: 'SUCCEEDED', audioInputMs: Number(row.duration_ms ?? 0), source: 'GATEWAY_MEASURED' };
    if (classified.kind === 'TOO_LONG') {
      await this.closeAttempt(row, attemptId, 'TRANSCRIPT_TOO_LONG', usage);
      await this.removeJob(attemptId, jobId);
      return;
    }
    // The text, band and uncertain words are durable FIRST (DELETION_PENDING); only then is the job deleted (§4.8).
    if (classified.kind === 'NO_SPEECH') {
      await this.notes.recordTranscript(attemptId, 'NO_SPEECH', null, null, null, fetched.providerDurationMs);
    } else {
      await this.notes.recordTranscript(attemptId, 'TRANSCRIBED', classified.text, classified.band, classified.uncertainTokens, fetched.providerDurationMs);
    }
    await this.settle(attemptId, row.user_id, usage);
    await this.removeJob(attemptId, jobId);
    this.signal('attempt', 'success');
  }

  // ------------------------------------------------------------------------------------------------ closing and deleting
  /** Record the attempt's failure class (the database decides PENDING / FAILED_RETRYABLE / FAILED_FINAL), then settle. */
  private async closeAttempt(row: ClaimedNoteRow, attemptId: string, failureClass: string, settlement: LedgerSettlement): Promise<void> {
    await this.notes.recordFailure(row.recording_id, this.workerId, attemptId, failureClass);
    await this.settle(attemptId, row.user_id, settlement);
    this.signal('attempt', settlement.outcome === 'CANCELLED_BEFORE_PROVIDER' || failureClass.startsWith('PROVIDER_') ? 'retry_expected' : 'refused_expected');
  }

  /** Every known job of the note whose first deletion outcome is not recorded yet (the claim lists them). */
  private async removeKnownJobs(row: ClaimedNoteRow): Promise<void> {
    const attempts = row.deletion_attempt_ids ?? [];
    const jobIds = row.deletion_job_ids ?? [];
    for (let i = 0; i < attempts.length && i < jobIds.length; i += 1) {
      await this.removeJob(attempts[i], jobIds[i] as ProviderJobId);
    }
  }

  /** One removal (no `force`), and its outcome recorded whatever it was (§4.8 step 2). */
  private async removeJob(attemptId: string, jobId: ProviderJobId): Promise<void> {
    let removal: RemovalOutcome;
    try {
      removal = await (this.jobs as BatchTranscriptionJobs).remove(jobId, this.callSignal(VOICE_WORKER_LIMITS.callMs));
    } catch {
      removal = { kind: 'TRANSIENT', failure: 'NETWORK' };
    }
    await this.recordDeletion(attemptId, REMOVAL_REPORT[removal.kind]);
  }

  private async recordDeletion(attemptId: string, report: ProviderDeletionReport): Promise<void> {
    await this.notes.recordProviderDeletion(attemptId, report);
    this.signal('provider_delete', report === 'REQUESTED' || report === 'ABSENT' ? 'success' : 'retry_expected');
  }

  /**
   * The deletion sweeper (§4.8 step 4): every job the database says is due — a removal for one not yet accepted, a status
   * check for one REQUESTED (404 / 410 → ABSENT). The schedule and the 7-day UNCONFIRMED horizon are the database's.
   */
  async sweepDeletions(): Promise<number> {
    if (this.jobs === null) return 0;
    let due;
    try {
      due = await this.notes.deletionsDue(VOICE_WORKER_LIMITS.deletionsPerSweep);
    } catch {
      this.signal('sweep', 'transport_failure');
      return 0;
    }
    for (const row of due) {
      try {
        const jobId = row.provider_job_id as ProviderJobId;
        if (row.provider_deletion_state !== 'REQUESTED') {
          await this.removeJob(row.attempt_id, jobId);
          continue;
        }
        let status;
        try {
          status = await this.jobs.status(jobId, this.callSignal(VOICE_WORKER_LIMITS.callMs));
        } catch {
          status = { kind: 'TRANSIENT' as const, failure: 'NETWORK' as const };
        }
        if (status.kind === 'ABSENT') await this.recordDeletion(row.attempt_id, 'ABSENT');
        else if (status.kind === 'TRANSIENT') await this.recordDeletion(row.attempt_id, 'TRANSIENT');
        else await this.removeJob(row.attempt_id, jobId);
      } catch {
        this.signal('sweep', 'transport_failure');
      }
    }
    this.signal('sweep', 'success');
    return due.length;
  }

  private async settle(attemptId: string, userId: string, settlement: LedgerSettlement): Promise<void> {
    try {
      await this.notes.settleAttempt(attemptId, userId, settlement);
    } catch {
      // The ledger row stays PENDING; the note's own state is already durable. recoverSettlements() settles it later.
      this.signal('ledger', 'transport_failure');
    }
  }

  /**
   * The ledger rows whose settlement did not land (record §5 decision 5): a terminal attempt still PENDING after the grace
   * is settled from durable facts only - the provider is never asked again. A transcript the provider returned (SUCCEEDED,
   * or TRANSCRIPT_TOO_LONG) is the duration proven locally before submission, GATEWAY_MEASURED (the provider's own duration
   * is not durable); every other end keeps its usage ABSENT (unpriced). settle_ai_provider_call_v2 makes a replay
   * ALREADY_SETTLED; a racing different settlement that landed first stands. Bounded per cycle; never throws.
   */
  async recoverSettlements(): Promise<number> {
    if (this.jobs === null) return 0;
    let rows: UnsettledAttemptRow[];
    try {
      rows = await this.notes.unsettledAttempts(VOICE_WORKER_LIMITS.settlementGraceSeconds, VOICE_WORKER_LIMITS.settlementsPerSweep);
    } catch {
      this.signal('ledger', 'transport_failure');
      return 0;
    }
    let settled = 0;
    for (const row of rows.slice(0, VOICE_WORKER_LIMITS.settlementsPerSweep)) {
      const transcribed = row.attempt_state === 'SUCCEEDED' || (row.attempt_state === 'FAILED' && row.failure_class === 'TRANSCRIPT_TOO_LONG');
      const durationMs = Number(row.duration_ms);
      if (transcribed && !(Number.isSafeInteger(durationMs) && durationMs > 0)) {
        // The measured duration is written before any submission; without it nothing is invented and the row stays PENDING.
        this.signal('ledger', 'integrity_failure');
        continue;
      }
      const settlement: LedgerSettlement = transcribed
        ? { outcome: 'SUCCEEDED', audioInputMs: durationMs, source: 'GATEWAY_MEASURED' }
        : { outcome: 'FAILED' };
      try {
        await this.notes.settleAttempt(row.attempt_id, row.user_id, settlement);
        settled += 1;
        this.signal('ledger', 'success');
      } catch {
        // Unreachable, or a racing settlement landed first (PT409): either way the row is listed again only while PENDING.
        this.signal('ledger', 'transport_failure');
      }
    }
    return settled;
  }

  private async release(row: ClaimedNoteRow): Promise<void> {
    try {
      await this.notes.renewLease(row.recording_id, this.workerId, 0);
    } catch {
      // The lease ends by itself.
    }
  }

  private callSignal(ms: number): AbortSignal {
    return AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(ms)]);
  }

  private signal(operation: 'claim' | 'attempt' | 'provider_delete' | 'sweep' | 'ledger', outcome: Telemetry): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_TRANSCRIPTION', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}

class NoteNotReadable extends Error {}
