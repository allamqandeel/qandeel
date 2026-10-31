import { randomUUID } from 'node:crypto';
import type {
  BatchSubmitRequest,
  BatchTranscriptionJobs,
  FetchOutcome,
  FindOutcome,
  JobStatus,
  ProviderJobId,
  RecognizedWord,
  RemovalOutcome,
  SubmitOutcome,
} from '../batch-transcription-jobs.port';

/**
 * S8B-03 (CP1, contract §4.10.6) — a deterministic, TEST-ONLY batch jobs port. No module binds it (the S8B-02 guard).
 * Every method counts its calls (the basis of "never transcribed twice"), and each answer can be scripted per call:
 * UNKNOWN after the audio was consumed, LOCKED, ABSENT, TRANSIENT, a reference found by reconciliation, and a crash
 * point (a thrown error) before or after any call.
 */
export interface FakeBatchScript {
  submit?: (SubmitOutcome | 'CREATED')[];
  status?: JobStatus[];
  fetchResult?: FetchOutcome[];
  remove?: RemovalOutcome[];
  findByReference?: FindOutcome[];
}

export type FakeBatchMethod = 'submit' | 'status' | 'fetchResult' | 'remove' | 'findByReference';

export class FakeBatchTranscriptionJobs implements BatchTranscriptionJobs {
  readonly provider = 'SPEECHMATICS' as const;
  readonly calls: Record<FakeBatchMethod, number> = { submit: 0, status: 0, fetchResult: 0, remove: 0, findByReference: 0 };
  /** Every job id this fake ever created, and the ones removed. */
  readonly created: ProviderJobId[] = [];
  readonly removed: ProviderJobId[] = [];
  /** The references and byte counts submitted (bytes are counted, never kept). */
  readonly submitted: { reference: string; bytes: number }[] = [];
  /** The words every DONE job returns unless `fetchResult` is scripted. */
  words: readonly RecognizedWord[] = [{ text: 'تجربة', confidence: 0.97, startMs: 0, endMs: 600 }];
  providerDurationMs: number | null = null;
  /** Throws (a crash of the caller's process, modelled as a programming fault) on the given call of a method. */
  private readonly crashes = new Map<FakeBatchMethod, Set<number>>();

  constructor(private readonly script: FakeBatchScript = {}) {}

  crashOn(method: FakeBatchMethod, call: number): this {
    const set = this.crashes.get(method) ?? new Set<number>();
    set.add(call);
    this.crashes.set(method, set);
    return this;
  }

  private enter(method: FakeBatchMethod): number {
    this.calls[method] += 1;
    const n = this.calls[method];
    if (this.crashes.get(method)?.has(n)) throw new Error(`FAKE_CRASH_${method}_${n}`);
    return n;
  }

  private next<T>(list: T[] | undefined, fallback: T): T {
    return list && list.length > 0 ? (list.length === 1 ? list[0] : list.shift()!) : fallback;
  }

  async submit(request: BatchSubmitRequest): Promise<SubmitOutcome> {
    this.enter('submit');
    const planned = this.next<SubmitOutcome | 'CREATED'>(this.script.submit, 'CREATED');
    if (typeof planned === 'object' && planned.kind === 'NOT_SENT') return planned; // nothing read
    let bytes = 0;
    for await (const chunk of request.audio) {
      if (request.signal.aborted) return { kind: 'UNKNOWN' };
      bytes += chunk.length;
    }
    this.submitted.push({ reference: request.reference, bytes });
    if (planned === 'CREATED') {
      const jobId = `fake-${randomUUID()}` as ProviderJobId;
      this.created.push(jobId);
      return { kind: 'CREATED', jobId };
    }
    if (planned.kind === 'CREATED') this.created.push(planned.jobId);
    return planned;
  }

  async status(jobId: ProviderJobId): Promise<JobStatus> {
    this.enter('status');
    if (this.removed.includes(jobId)) return { kind: 'ABSENT' };
    return this.next<JobStatus>(this.script.status, { kind: 'DONE' });
  }

  async fetchResult(): Promise<FetchOutcome> {
    this.enter('fetchResult');
    return this.next<FetchOutcome>(this.script.fetchResult, { kind: 'RESULT', words: this.words, providerDurationMs: this.providerDurationMs });
  }

  async remove(jobId: ProviderJobId): Promise<RemovalOutcome> {
    this.enter('remove');
    const outcome = this.next<RemovalOutcome>(this.script.remove, { kind: 'REQUESTED' });
    if (outcome.kind === 'REQUESTED' || outcome.kind === 'ABSENT') this.removed.push(jobId);
    return outcome;
  }

  async findByReference(): Promise<FindOutcome> {
    this.enter('findByReference');
    return this.next<FindOutcome>(this.script.findByReference, { kind: 'UNSUPPORTED' });
  }
}
