import type { LedgerSettlement, ProviderDeletionReport, ClaimedNoteRow } from '../voice-media/voice-notes.repository';
import type { VoiceMediaService } from '../voice-media/voice-media.service';
import type { VoiceNotesRepository } from '../voice-media/voice-notes.repository';
import { DEFAULT_ASR_BAND_THRESHOLDS } from './asr-confidence/asr-confidence';
import type { ProviderJobId } from './batch-transcription-jobs.port';
import { buildM4aFixture } from './testing/m4a-fixture.writer';
import { FakeBatchTranscriptionJobs } from './testing/fake-batch-transcription-jobs';
import { VOICE_WORKER_LIMITS, VoiceNoteTranscriptionWorker, type VoiceWorkerClock } from './voice-note-transcription.worker';

/**
 * S8B-03 (CP1, A6 / A7 / A8 / A9 / A24 / A25) — the worker against the fake batch jobs port and an IN-MEMORY model of the
 * 0186 transitions it drives (claim, lease, begin, record, fail, hold, deletion). The model mirrors the definers'
 * rules that the worker depends on; the definers themselves are proven on PostgreSQL by verify-0186 (V-T*, V-D*, V-RC*).
 * A "crash" is a thrown error at a chosen point, then the lease ends and a SECOND worker claims the note.
 */
const QUARANTINE_MS = VOICE_WORKER_LIMITS.unknownQuarantineMs;
const TRANSIENT = new Set(['PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK', 'POLL_TIMEOUT', 'NOT_CREATED', 'STORAGE_UNAVAILABLE']);
const USER = '00000000-0000-4000-8000-000000000001';
const REC = '00000000-0000-4000-8000-0000000000aa';

interface Attempt {
  id: string; state: string; jobId: string | null; unknownSince: number | null; submittedAt: number | null;
  deletion: string; firstDeletionAt: number | null; nextDeletionAt: number | null; failureClass: string | null;
}

class Model {
  now = 1_000_000;
  consent = true;
  gate = true;
  readable = true;
  state = 'PENDING';
  pendingOutcome: string | null = null;
  attemptsAuto = 0;
  attemptsTotal = 0;
  byUser = false;
  nextAttemptAt: number | null = null;
  lease: { owner: string; expires: number } | null = null;
  durationMs: number | null = null;
  transcript: string | null = null;
  band: string | null = null;
  failureClass: string | null = null;
  readonly attempts: Attempt[] = [];
  readonly ledger: { attemptId: string; settlement: LedgerSettlement }[] = [];
  readonly unsettledReads: [number, number][] = [];
  /** When an attempt was first seen terminal: the model's stand-in for settled_at, which the grace counts from. */
  readonly terminalSince = new Map<string, number>();
  readonly events: string[] = [];
  private readonly crashes = new Map<string, 'before' | 'after'>();

  crash(method: string, when: 'before' | 'after' = 'before') { this.crashes.set(method, when); return this; }
  private hook<T>(method: string, apply: () => T): T {
    const when = this.crashes.get(method);
    if (when) this.crashes.delete(method);
    if (when === 'before') throw new Error(`MODEL_CRASH_${method}`);
    const result = apply();
    this.events.push(method);
    if (when === 'after') throw new Error(`MODEL_CRASH_AFTER_${method}`);
    return result;
  }
  endLeases() { this.now += VOICE_WORKER_LIMITS.leaseSeconds * 1000 + 1; }
  private leased(worker: string) { return this.lease?.owner === worker && this.lease.expires > this.now; }
  private firstDeletionsRecorded() { return this.attempts.every((a) => a.jobId === null || a.firstDeletionAt !== null); }
  private settleNote(outcome: string, failureClass: string | null): string {
    const v = this.firstDeletionsRecorded() ? outcome : 'DELETION_PENDING';
    this.state = v;
    this.pendingOutcome = v === 'DELETION_PENDING' ? outcome : null;
    if (failureClass) this.failureClass = failureClass;
    if (outcome !== 'READY') this.transcript = null;
    this.lease = null;
    if (outcome === 'FAILED_RETRYABLE') this.nextAttemptAt = null;
    return v;
  }
  attempt(id: string) { return this.attempts.find((a) => a.id === id)!; }

  readonly repository = {
    claim: async (worker: string, leaseSeconds: number): Promise<ClaimedNoteRow[]> => this.hook('claim', () => {
      if (this.lease && this.lease.expires > this.now) return [];
      const ready = (this.state === 'PENDING' || this.state === 'HELD_CONSENT') ? this.gate && (this.nextAttemptAt === null || this.nextAttemptAt <= this.now)
        : this.state === 'IN_PROGRESS' ? (this.nextAttemptAt === null || this.nextAttemptAt <= this.now) : this.state === 'DELETION_PENDING';
      if (!ready) return [];
      if (this.state === 'PENDING' || this.state === 'HELD_CONSENT') {
        if (!this.consent) { this.state = 'HELD_CONSENT'; return []; }
        this.state = 'PENDING';
      }
      const submitting = this.attempts.filter((a) => a.state === 'SUBMITTING');
      for (const a of submitting) { a.state = 'OUTCOME_UNKNOWN'; a.unknownSince = this.now; }
      if (submitting.length > 0) this.nextAttemptAt = this.now + QUARANTINE_MS;
      this.lease = { owner: worker, expires: this.now + leaseSeconds * 1000 };
      const open = this.attempts.find((a) => a.state === 'SUBMITTED' || a.state === 'OUTCOME_UNKNOWN') ?? null;
      const due = this.attempts.filter((a) => a.jobId !== null && a.firstDeletionAt === null && ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(a.state));
      return [{
        recording_id: REC, user_id: USER, session_id: 's', byte_size: media.bytes.length, state: this.state as ClaimedNoteRow['state'],
        duration_ms: this.durationMs, attempts_total: this.attemptsTotal, attempt_id: open?.id ?? null,
        attempt_state: (open?.state ?? null) as ClaimedNoteRow['attempt_state'], provider_job_id: open?.jobId ?? null,
        unknown_since: open?.unknownSince != null ? new Date(open.unknownSince).toISOString() : null, submitted_at: null,
        deletion_attempt_ids: due.map((a) => a.id), deletion_job_ids: due.map((a) => a.jobId!),
      }];
    }),
    renewLease: async (_rec: string, worker: string, seconds: number) => this.hook('renewLease', () => {
      if (this.state === 'CANCELLED' || this.pendingOutcome === 'CANCELLED') return { outcome: 'CANCELLED' as const };
      if (!this.leased(worker)) return { outcome: 'LEASE_LOST' as const };
      if (seconds === 0) { this.lease = null; return { outcome: 'RELEASED' as const }; }
      this.lease = { owner: worker, expires: this.now + seconds * 1000 };
      if (this.state === 'IN_PROGRESS' && !this.consent) return { outcome: 'CONSENT_WITHDRAWN' as const };
      return { outcome: 'RENEWED' as const };
    }),
    beginSubmission: async (_rec: string, worker: string, attemptId: string, durationMs: number) => this.hook('beginSubmission', () => {
      if (!this.leased(worker)) return { outcome: 'LEASE_LOST' as const, ordinal: null };
      if (this.attempts.some((a) => ['SUBMITTING', 'SUBMITTED', 'OUTCOME_UNKNOWN'].includes(a.state))) return { outcome: 'NOT_CLAIMABLE' as const, ordinal: null };
      if (!this.consent) { this.settleNote('HELD_CONSENT', null); return { outcome: 'HELD_CONSENT' as const, ordinal: null }; }
      if (this.attemptsTotal >= 5) { this.settleNote('FAILED_FINAL', 'ATTEMPTS_EXHAUSTED'); return { outcome: 'ATTEMPTS_EXHAUSTED' as const, ordinal: null }; }
      if (!this.byUser && this.attemptsAuto >= 3) { this.settleNote('FAILED_RETRYABLE', 'ATTEMPTS_EXHAUSTED'); return { outcome: 'ATTEMPTS_EXHAUSTED' as const, ordinal: null }; }
      this.attempts.push({ id: attemptId, state: 'SUBMITTING', jobId: null, unknownSince: null, submittedAt: null, deletion: 'PENDING', firstDeletionAt: null, nextDeletionAt: null, failureClass: null });
      this.attemptsTotal += 1;
      if (!this.byUser) this.attemptsAuto += 1;
      this.byUser = false;
      this.state = 'IN_PROGRESS';
      this.durationMs = durationMs;
      this.nextAttemptAt = null;
      return { outcome: 'SUBMITTING' as const, ordinal: this.attemptsTotal };
    }),
    recordSubmission: async (attemptId: string, outcome: 'CREATED' | 'UNKNOWN', jobId: string | null) => this.hook('recordSubmission', () => {
      const a = this.attempt(attemptId);
      if (outcome === 'CREATED') {
        if (a.jobId === jobId) return { outcome: 'ALREADY_RECORDED' as const };
        a.jobId = jobId;
        a.submittedAt = this.now;
        if (['SUBMITTING', 'OUTCOME_UNKNOWN'].includes(a.state) && this.state === 'IN_PROGRESS') { a.state = 'SUBMITTED'; this.nextAttemptAt = null; return { outcome: 'RECORDED' as const }; }
        a.state = 'CANCELLED';
        return { outcome: 'RECORDED_FOR_DELETION' as const };
      }
      if (a.state === 'OUTCOME_UNKNOWN') return { outcome: 'ALREADY_RECORDED' as const };
      a.state = 'OUTCOME_UNKNOWN';
      a.unknownSince = this.now;
      this.nextAttemptAt = this.now + QUARANTINE_MS;
      return { outcome: 'RECORDED' as const };
    }),
    recordTranscript: async (attemptId: string, outcome: string, text: string | null, band: string | null) => this.hook('recordTranscript', () => {
      const a = this.attempt(attemptId);
      if (a.state !== 'SUBMITTED') return { outcome: a.state === 'SUCCEEDED' ? 'ALREADY_RECORDED' : 'NOT_SUBMITTED', state: this.state };
      a.state = 'SUCCEEDED';
      if (!this.consent) return { outcome: 'HELD_CONSENT', state: this.settleNote('HELD_CONSENT', null) };
      if (outcome === 'NO_SPEECH') return { outcome: 'RECORDED', state: this.settleNote('NO_SPEECH', null) };
      this.transcript = text;
      this.band = band;
      // record_transcript keeps the lease while DELETION_PENDING (only READY releases it).
      const lease = this.lease;
      const state = this.settleNote('READY', null);
      if (state === 'DELETION_PENDING') this.lease = lease;
      return { outcome: 'RECORDED', state };
    }),
    recordProviderDeletion: async (attemptId: string, report: ProviderDeletionReport) => this.hook('recordProviderDeletion', () => {
      const a = this.attempt(attemptId);
      a.deletion = report === 'ABSENT' ? 'PROVIDER_ABSENT' : report === 'REQUESTED' ? 'REQUESTED' : 'RETRYING';
      a.firstDeletionAt ??= this.now;
      a.nextDeletionAt = a.deletion === 'PROVIDER_ABSENT' ? null : this.now + 60_000;
      if (this.state === 'DELETION_PENDING' && this.firstDeletionsRecorded()) this.settleNote(this.pendingOutcome!, null);
      return { outcome: 'RECORDED', provider_deletion_state: a.deletion, note_state: this.state };
    }),
    recordFailure: async (_rec: string, worker: string, attemptId: string | null, failureClass: string) => this.hook('recordFailure', () => {
      if (attemptId === null) {
        if (!this.leased(worker)) return { outcome: 'LEASE_LOST', state: this.state };
        if (failureClass === 'STORAGE_UNAVAILABLE') { this.lease = null; this.nextAttemptAt = this.now + 60_000; return { outcome: 'DEFERRED', state: this.state }; }
        return { outcome: 'RECORDED', state: this.settleNote('FAILED_FINAL', failureClass) };
      }
      const a = this.attempt(attemptId);
      if (failureClass === 'UNCERTAIN_SUBMISSION' && (a.state !== 'OUTCOME_UNKNOWN' || this.now < a.unknownSince! + QUARANTINE_MS)) {
        throw Object.assign(new Error('VOICE_TRANSCRIPTION_TRANSITION_REFUSED'), { code: '55000' });
      }
      a.state = 'FAILED';
      a.failureClass = failureClass;
      if (a.jobId === null) a.deletion = failureClass === 'UNCERTAIN_SUBMISSION' ? 'UNKNOWN_JOB' : 'NOT_APPLICABLE';
      const transient = TRANSIENT.has(failureClass);
      const next = transient && this.attemptsAuto < 3 && this.attemptsTotal < 5 ? 'PENDING'
        : (transient || failureClass === 'UNCERTAIN_SUBMISSION') && this.attemptsTotal < 5 ? 'FAILED_RETRYABLE' : 'FAILED_FINAL';
      if (next === 'PENDING') this.nextAttemptAt = this.now + 30_000 * 4 ** Math.max(this.attemptsAuto - 1, 0);
      return { outcome: 'RECORDED', state: this.settleNote(next, failureClass) };
    }),
    holdForConsent: async () => this.hook('holdForConsent', () => {
      for (const a of this.attempts) if (a.state === 'SUBMITTED') a.state = 'CANCELLED';
      return { outcome: 'HELD', state: this.settleNote('HELD_CONSENT', null) };
    }),
    deletionsDue: async () => this.hook('deletionsDue', () => this.attempts
      .filter((a) => a.jobId !== null && ['PENDING', 'REQUESTED', 'RETRYING'].includes(a.deletion) && ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(a.state)
        && (a.nextDeletionAt ?? 0) <= this.now && (a.firstDeletionAt !== null || this.lease === null || this.lease.expires <= this.now))
      .map((a) => { a.nextDeletionAt = this.now + 120_000; return { attempt_id: a.id, provider_job_id: a.jobId!, provider_deletion_state: a.deletion, deletion_attempts: 0 }; })),
    // A terminal attempt with no ledger settlement, once the grace has passed (V-L2 proves the definer on PostgreSQL).
    unsettledAttempts: async (grace: number, limit: number) => this.hook('unsettledAttempts', () => {
      this.unsettledReads.push([grace, limit]);
      const terminal = this.attempts.filter((a) => ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(a.state));
      for (const a of terminal) if (!this.terminalSince.has(a.id)) this.terminalSince.set(a.id, this.now);
      return terminal
        .filter((a) => this.now - this.terminalSince.get(a.id)! >= grace * 1000 && !this.ledger.some((l) => l.attemptId === a.id))
        .slice(0, limit)
        .map((a) => ({ attempt_id: a.id, user_id: USER, attempt_state: a.state, failure_class: a.failureClass, duration_ms: this.durationMs === null ? null : String(this.durationMs) }));
    }),
    settleAttempt: async (attemptId: string, _user: string, settlement: LedgerSettlement) => this.hook('settleAttempt', () => {
      this.ledger.push({ attemptId, settlement });
      return { settle_outcome: 'SETTLED', call_state: settlement.outcome };
    }),
  };
}

const media = {
  bytes: buildM4aFixture({ durationMs: 4000 }),
  reads: 0,
  opened: 0,
  readNoteRange: async (_u: string, _r: string, offset: number, length: number) => {
    media.reads += 1;
    return model.readable ? media.bytes.subarray(offset, Math.min(media.bytes.length, offset + length)) : null;
  },
  openNoteForTranscription: async () => {
    media.opened += 1;
    if (!model.readable) return null;
    const bytes = media.bytes;
    return { byteSize: bytes.length, audio: (async function* () { yield bytes; })() };
  },
};

let model: Model;
let jobs: FakeBatchTranscriptionJobs;
const clock: VoiceWorkerClock = { now: () => model.now, wait: async (ms) => { model.now += ms; } };
const worker = () => new VoiceNoteTranscriptionWorker(
  model.repository as unknown as VoiceNotesRepository, media as unknown as VoiceMediaService,
  { enabled: true, concurrency: 2, thresholds: DEFAULT_ASR_BAND_THRESHOLDS }, jobs, undefined, clock);

beforeEach(() => {
  model = new Model();
  jobs = new FakeBatchTranscriptionJobs();
  media.bytes = buildM4aFixture({ durationMs: 4000 });
  media.reads = 0;
  media.opened = 0;
});

describe('VoiceNoteTranscriptionWorker — one attempt (§4.10.4)', () => {
  it('PENDING → proof → SUBMITTING → CREATED → DONE → transcript durable → removal recorded → READY, settled once', async () => {
    await worker().runOnce();
    expect(jobs.calls).toEqual({ submit: 1, status: 1, fetchResult: 1, remove: 1, findByReference: 0 });
    expect(model.state).toBe('READY');
    expect(model.transcript).toBe('تجربة');
    expect(model.band).toBe('HIGH');
    expect(model.durationMs).toBe(4000);
    expect(jobs.submitted).toEqual([{ reference: model.attempts[0].id, bytes: media.bytes.length }]);
    // A25: the text was durable (DELETION_PENDING) before the removal, and READY only after its outcome was recorded.
    expect(model.events.filter((e) => ['recordTranscript', 'recordProviderDeletion'].includes(e))).toEqual(['recordTranscript', 'recordProviderDeletion']);
    expect(model.attempts[0].deletion).toBe('REQUESTED');
    // A9: one ledger row per attempt, GATEWAY_MEASURED from the local proof when the provider reported no duration.
    expect(model.ledger).toEqual([{ attemptId: model.attempts[0].id, settlement: { outcome: 'SUCCEEDED', audioInputMs: 4000, source: 'GATEWAY_MEASURED' } }]);
  });

  it('A9: a provider-reported duration settles PROVIDER_REPORTED', async () => {
    jobs.providerDurationMs = 4100;
    await worker().runOnce();
    expect(model.ledger[0].settlement).toEqual({ outcome: 'SUCCEEDED', audioInputMs: 4100, source: 'PROVIDER_REPORTED' });
  });

  it('a low-confidence negation is LOW; no words is NO_SPEECH (no turn)', async () => {
    jobs.words = [{ text: 'أنا', confidence: 0.99, startMs: 0, endMs: 900 }, { text: 'مش', confidence: 0.6, startMs: 950, endMs: 1100 }];
    await worker().runOnce();
    expect(model.band).toBe('LOW');
    model = new Model();
    jobs = new FakeBatchTranscriptionJobs();
    jobs.words = [];
    await worker().runOnce();
    expect(model.state).toBe('NO_SPEECH');
    expect(model.transcript).toBeNull();
  });

  it('the provider is polled with back-off and the lease renewed every round, never re-submitted', async () => {
    jobs = new FakeBatchTranscriptionJobs({ status: [{ kind: 'RUNNING' }, { kind: 'RUNNING' }, { kind: 'TRANSIENT', failure: 'UNAVAILABLE' }, { kind: 'DONE' }] });
    const start = model.now;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(1);
    expect(jobs.calls.status).toBe(4);
    expect(model.now - start).toBe(2000 + 4000 + 8000);
    expect(model.events.filter((e) => e === 'renewLease')).toHaveLength(4);
    expect(model.state).toBe('READY');
  });

  it('a job still running after 15 minutes → POLL_TIMEOUT (transient), its job removed', async () => {
    jobs = new FakeBatchTranscriptionJobs({ status: [{ kind: 'RUNNING' }] });
    await worker().runOnce();
    expect(model.attempts[0]).toMatchObject({ state: 'FAILED', failureClass: 'POLL_TIMEOUT', deletion: 'REQUESTED' });
    expect(model.state).toBe('PENDING');
    expect(jobs.calls.remove).toBe(1);
    expect(model.ledger[0].settlement).toEqual({ outcome: 'FAILED' });
  });
});

describe('A7 — the duration proof refuses before any provider call', () => {
  it.each([
    ['602 s', { durationMs: 602_000 }, 'AUDIO_DURATION_OVER_LIMIT'],
    ['stereo', { durationMs: 2000, channels: 2 }, 'AUDIO_CONTAINER_UNSUPPORTED'],
    ['truncated', { durationMs: 2000, truncateBy: 100 }, 'AUDIO_CONTAINER_TRUNCATED'],
  ])('%s → FAILED_FINAL with its class, submit = 0, no attempt counted, no ledger row', async (_name, options, failureClass) => {
    media.bytes = buildM4aFixture(options);
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(0);
    expect(media.opened).toBe(0);
    expect(model.attempts).toHaveLength(0);
    expect(model.attemptsTotal).toBe(0);
    expect(model).toMatchObject({ state: 'FAILED_FINAL', failureClass });
    expect(model.ledger).toHaveLength(0);
  });

  it('a note no longer readable is deferred, not submitted', async () => {
    model.readable = false;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(0);
    expect(model.state).toBe('PENDING');
  });
});

describe('A7 / A8 — failures, limits and an unknown outcome', () => {
  it('NOT_SENT → transient: PENDING with a back-off, settled CANCELLED_BEFORE_PROVIDER; 3 automatic attempts, then FAILED_RETRYABLE', async () => {
    jobs = new FakeBatchTranscriptionJobs({ submit: [{ kind: 'NOT_SENT', failure: 'UNAVAILABLE' }] });
    for (let round = 0; round < 6; round += 1) {
      await worker().runOnce();
      model.now += 60 * 60_000;
    }
    expect(jobs.calls.submit).toBe(3);
    expect(model.attemptsAuto).toBe(3);
    expect(model.state).toBe('FAILED_RETRYABLE');
    expect(model.ledger.map((l) => l.settlement.outcome)).toEqual(['CANCELLED_BEFORE_PROVIDER', 'CANCELLED_BEFORE_PROVIDER', 'CANCELLED_BEFORE_PROVIDER']);
  });

  it('REJECTED → FAILED_FINAL at once (permanent), never retried', async () => {
    jobs = new FakeBatchTranscriptionJobs({ submit: [{ kind: 'REJECTED', failure: 'UNSUPPORTED_AUDIO' }] });
    await worker().runOnce();
    model.now += 60 * 60_000;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(1);
    expect(model).toMatchObject({ state: 'FAILED_FINAL', failureClass: 'PROVIDER_UNSUPPORTED_AUDIO' });
  });

  it('UNKNOWN → OUTCOME_UNKNOWN; without reconciliation no automatic re-submission, and after the quarantine FAILED_RETRYABLE / UNKNOWN_JOB', async () => {
    jobs = new FakeBatchTranscriptionJobs({ submit: [{ kind: 'UNKNOWN' }] });
    await worker().runOnce();
    expect(model.attempts[0].state).toBe('OUTCOME_UNKNOWN');
    expect(model.state).toBe('IN_PROGRESS');
    model.endLeases();
    await worker().runOnce(); // inside the quarantine: nothing is claimable
    expect(jobs.calls.submit).toBe(1);
    model.now += QUARANTINE_MS;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(1);
    expect(model.attempts[0]).toMatchObject({ state: 'FAILED', failureClass: 'UNCERTAIN_SUBMISSION', deletion: 'UNKNOWN_JOB' });
    expect(model.state).toBe('FAILED_RETRYABLE');
  });

  it('UNKNOWN → findByReference FOUND (reconciliation enabled) → the job is adopted, completed and deleted', async () => {
    const jobId = 'adopted-job' as ProviderJobId;
    jobs = new FakeBatchTranscriptionJobs({ submit: [{ kind: 'UNKNOWN' }], findByReference: [{ kind: 'FOUND', jobId }] });
    await worker().runOnce();
    expect(jobs.calls).toMatchObject({ submit: 1, findByReference: 1, fetchResult: 1, remove: 1 });
    expect(model.attempts[0]).toMatchObject({ state: 'SUCCEEDED', jobId, deletion: 'REQUESTED' });
    expect(model.state).toBe('READY');
  });

  it('UNKNOWN → NOT_FOUND_IN_COMPLETE_LISTING → NOT_CREATED (counted, transient)', async () => {
    jobs = new FakeBatchTranscriptionJobs({ submit: [{ kind: 'UNKNOWN' }], findByReference: [{ kind: 'NOT_FOUND_IN_COMPLETE_LISTING' }] });
    await worker().runOnce();
    expect(model.attempts[0]).toMatchObject({ state: 'FAILED', failureClass: 'NOT_CREATED' });
    expect(model.attemptsTotal).toBe(1);
    expect(model.state).toBe('PENDING');
  });
});

describe('A6 — logically once under crashes (the lease ends, a second worker resumes)', () => {
  it('(1) after submit, before the job id is recorded → OUTCOME_UNKNOWN, submit = 1, no automatic re-submission', async () => {
    model.crash('recordSubmission');
    await worker().runOnce();
    expect(model.attempts[0].state).toBe('SUBMITTING');
    model.endLeases();
    await worker().runOnce();
    expect(model.attempts[0].state).toBe('OUTCOME_UNKNOWN');
    model.now += QUARANTINE_MS;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(1);
    expect(model.state).toBe('FAILED_RETRYABLE');
  });

  it('(2) after the job id is recorded → status / fetchResult of the SAME job, submit = 1', async () => {
    model.crash('renewLease');
    await worker().runOnce();
    expect(model.attempts[0].state).toBe('SUBMITTED');
    model.endLeases();
    await worker().runOnce();
    expect(jobs.calls).toMatchObject({ submit: 1, status: 1, fetchResult: 1, remove: 1 });
    expect(jobs.created).toHaveLength(1);
    expect(model.state).toBe('READY');
  });

  it('(3) after the transcript is durable, before the removal → removal only, submit = 1, fetchResult = 1', async () => {
    model.crash('recordTranscript', 'after');
    await worker().runOnce();
    expect(model.state).toBe('DELETION_PENDING');
    model.endLeases();
    await worker().runOnce();
    expect(jobs.calls).toMatchObject({ submit: 1, fetchResult: 1, remove: 1 });
    expect(model.state).toBe('READY');
    expect(model.transcript).toBe('تجربة');
  });

  it('(4) after the removal was sent, before its outcome is recorded → a second removal only', async () => {
    model.crash('recordProviderDeletion');
    await worker().runOnce();
    expect(jobs.calls.remove).toBe(1);
    expect(model.state).toBe('DELETION_PENDING');
    model.endLeases();
    await worker().runOnce();
    expect(jobs.calls).toMatchObject({ submit: 1, fetchResult: 1, remove: 2 });
    expect(model.state).toBe('READY');
  });
});

describe('A24 — consent in the path (§4.7)', () => {
  it('withdrawn before SUBMITTING → HELD_CONSENT, nothing sent', async () => {
    model.consent = false;
    await worker().runOnce();
    expect(jobs.calls.submit).toBe(0);
    expect(model.state).toBe('HELD_CONSENT');
  });

  it('withdrawn while the job runs → held, the job deleted, no text kept', async () => {
    jobs = new FakeBatchTranscriptionJobs({ status: [{ kind: 'RUNNING' }] });
    const original = model.repository.renewLease;
    let rounds = 0;
    model.repository.renewLease = async (...args) => {
      rounds += 1;
      if (rounds === 2) model.consent = false;
      return original(...args);
    };
    await worker().runOnce();
    expect(model.state).toBe('HELD_CONSENT');
    expect(model.transcript).toBeNull();
    expect(jobs.calls.fetchResult).toBe(0);
    expect(jobs.calls.remove).toBe(1);
    expect(model.attempts[0]).toMatchObject({ state: 'CANCELLED', deletion: 'REQUESTED' });
  });
});

describe('A25 — the deletion order and the sweeper', () => {
  it('a LOCKED or failing removal is recorded and does not hold the note: READY after the first outcome, retried later, never forced', async () => {
    jobs = new FakeBatchTranscriptionJobs({ remove: [{ kind: 'LOCKED' }, { kind: 'TRANSIENT', failure: 'UNAVAILABLE' }, { kind: 'REQUESTED' }] });
    await worker().runOnce();
    expect(model.state).toBe('READY');
    expect(model.attempts[0].deletion).toBe('RETRYING');
    model.now += 60_000;
    await worker().sweepDeletions();
    expect(model.attempts[0].deletion).toBe('RETRYING');
    model.now += 120_000;
    await worker().sweepDeletions();
    expect(model.attempts[0].deletion).toBe('REQUESTED');
    expect(jobs.calls.remove).toBe(3);
  });

  it('a REQUESTED removal is verified by status: 404 → PROVIDER_ABSENT', async () => {
    await worker().runOnce();
    expect(model.attempts[0].deletion).toBe('REQUESTED');
    model.now += 60_000;
    await worker().sweepDeletions();
    expect(model.attempts[0].deletion).toBe('PROVIDER_ABSENT');
    expect(jobs.calls.remove).toBe(1);
  });

  it('a provider failure after CREATED: FAILED with its class and the job still deleted', async () => {
    jobs = new FakeBatchTranscriptionJobs({ status: [{ kind: 'FAILED', failure: 'UNSUPPORTED_AUDIO' }] });
    await worker().runOnce();
    expect(model).toMatchObject({ state: 'FAILED_FINAL', failureClass: 'PROVIDER_UNSUPPORTED_AUDIO' });
    expect(model.attempts[0].deletion).toBe('REQUESTED');
  });
});

describe('the worker is off unless configured', () => {
  it('no jobs port (no server key) → not enabled, runOnce does nothing', async () => {
    const off = new VoiceNoteTranscriptionWorker(model.repository as unknown as VoiceNotesRepository, media as unknown as VoiceMediaService,
      { enabled: true, concurrency: 2, thresholds: DEFAULT_ASR_BAND_THRESHOLDS }, null, undefined, clock);
    expect(off.enabled).toBe(false);
    expect(await off.runOnce()).toEqual({ claimed: 0, deletions: 0, settlements: 0 });
    expect(await off.recoverSettlements()).toBe(0);
    expect(model.events).toHaveLength(0);
  });
});

describe('the ledger row a lost settlement left PENDING (record §5 decision 5)', () => {
  const terminal = (id: string, state: string, failureClass: string | null = null) => {
    model.attempts.push({ id, state, jobId: null, unknownSince: null, submittedAt: null, deletion: 'NOT_APPLICABLE', firstDeletionAt: null, nextDeletionAt: null, failureClass });
    model.terminalSince.set(id, model.now - VOICE_WORKER_LIMITS.settlementGraceSeconds * 1000);
  };

  it('is settled once from durable facts by a later cycle: no provider call, no second row', async () => {
    jobs.providerDurationMs = 4100;
    model.crash('settleAttempt');
    const w = worker();
    expect(await w.runOnce()).toMatchObject({ claimed: 1, settlements: 0 });
    expect(model.state).toBe('READY');
    expect(model.ledger).toEqual([]);
    // Inside the grace the worker's own settlement may still be landing: nothing is touched.
    expect(await w.runOnce()).toMatchObject({ claimed: 0, settlements: 0 });
    model.now += VOICE_WORKER_LIMITS.settlementGraceSeconds * 1000;
    const calls = { ...jobs.calls };
    expect(await w.recoverSettlements()).toBe(1);
    // The provider's own duration is not durable: the duration proven locally before submission, labelled so.
    expect(model.ledger).toEqual([{ attemptId: model.attempts[0].id, settlement: { outcome: 'SUCCEEDED', audioInputMs: 4000, source: 'GATEWAY_MEASURED' } }]);
    expect(jobs.calls).toEqual(calls);
    expect(await w.recoverSettlements()).toBe(0);
    expect(model.ledger).toHaveLength(1);
    expect(model.unsettledReads.every(([grace, limit]) => grace === VOICE_WORKER_LIMITS.settlementGraceSeconds && limit === VOICE_WORKER_LIMITS.settlementsPerSweep)).toBe(true);
  });

  it('a returned transcript is the measured duration; every other end keeps its usage unknown (FAILED, ABSENT)', async () => {
    model.durationMs = 4000;
    terminal('a-ok', 'SUCCEEDED');
    terminal('a-long', 'FAILED', 'TRANSCRIPT_TOO_LONG');
    terminal('a-timeout', 'FAILED', 'PROVIDER_TIMEOUT');
    terminal('a-unknown', 'FAILED', 'UNCERTAIN_SUBMISSION');
    terminal('a-cancel', 'CANCELLED');
    terminal('a-open', 'SUBMITTED');
    expect(await worker().recoverSettlements()).toBe(5);
    const measured = { outcome: 'SUCCEEDED', audioInputMs: 4000, source: 'GATEWAY_MEASURED' };
    expect(Object.fromEntries(model.ledger.map((l) => [l.attemptId, l.settlement]))).toEqual({
      'a-ok': measured, 'a-long': measured, 'a-timeout': { outcome: 'FAILED' }, 'a-unknown': { outcome: 'FAILED' }, 'a-cancel': { outcome: 'FAILED' },
    });
    expect(jobs.calls).toEqual({ submit: 0, status: 0, fetchResult: 0, remove: 0, findByReference: 0 });
  });

  it('without a proven duration a transcript is not invented (the row stays PENDING); bounded per cycle; never throws', async () => {
    terminal('a-ok', 'SUCCEEDED');
    terminal('a-failed', 'FAILED', 'PROVIDER_TIMEOUT');
    expect(await worker().recoverSettlements()).toBe(1);
    expect(model.ledger).toEqual([{ attemptId: 'a-failed', settlement: { outcome: 'FAILED' } }]);
    model = new Model();
    model.durationMs = 4000;
    for (let i = 0; i < VOICE_WORKER_LIMITS.settlementsPerSweep + 5; i += 1) terminal(`a-${i}`, 'FAILED', 'PROVIDER_TIMEOUT');
    expect(await worker().recoverSettlements()).toBe(VOICE_WORKER_LIMITS.settlementsPerSweep);
    model.crash('settleAttempt');
    expect(await worker().recoverSettlements()).toBe(4);
    model.crash('unsettledAttempts');
    expect(await worker().recoverSettlements()).toBe(0);
  });
});
