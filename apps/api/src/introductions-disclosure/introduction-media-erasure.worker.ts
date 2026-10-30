import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import { IntroductionDisclosureRepository } from './introduction-disclosure.repository';
import { INTRODUCTION_MEDIA_STORE } from './introduction-disclosure.service';
import type { IntroductionMediaObjectStore } from './introduction-media.store';
import {
  PRIVATE_AUDIO_OBJECT_STORE, VOICE_KEY_PREFIXES, isVoiceKey, type PrivateAudioObjectStore,
} from '../voice-media/private-audio-object.store';
import { VoiceMediaRepository } from '../voice-media/voice-media.repository';

const DEFAULT_POLL_MS = 30_000;
const SWEEP_LIMIT = 50;
const CLAIM_LIMIT = 25;
const LEASE_SECONDS = 120;
const STORE_BUDGET_MS = 15_000;
/** The listing reconciliation runs every RECONCILE_EVERY cycles, over objects older than the grace period. */
const RECONCILE_EVERY = 20;
const RECONCILE_GRACE_MS = 10 * 60_000;

/**
 * S6-06 (correction 2, conditions 1 and 2) — the physical erasure of Introduction photo objects.
 *
 * Access is refused the moment a deletion commits (the database removes the rendition in that transaction); this worker
 * makes the object itself go, from database truth only:
 *
 *   1  sweep      retire expired uploads, photos of Worlds that left ACTIVE / INTRODUCTION, and stages deleted through
 *                 the generic owner deletion - their keys alone move to the queue
 *   2  erase      lease due keys (SKIP LOCKED), DELETE each object, then prove it gone with HEAD; only a proven absence
 *                 confirms (and removes the queue row); any failure defers it with a back-off and it is never dropped
 *   3  reconcile  every RECONCILE_EVERY cycles, list the stored keys older than the grace period and enqueue every one
 *                 the database no longer knows - so an object written after its erasure (a late upload) cannot survive
 *
 * One cycle at a time, a timer that never keeps the process alive, off under tests and whenever the object store or
 * the server authority is not configured. It reads nothing but keys, and logs and reports nothing of content.
 *
 * S8B-02 (CP2, contract §3.10 / §3.11) — GENERALIZED, not duplicated: the one queue also holds `voice-note/` and
 * `voice-call/` keys (0183), so this one worker erases them with the same lease, back-off, DELETE then HEAD 404 and
 * confirmation, through the private audio store; the account erasure's `media_erased_at` follows from the same confirm
 * (0164's trigger), for photo and voice keys alike. A voice key while the audio store is not composed is deferred, never
 * dropped. The reconciliation also lists each voice prefix and queues what the database no longer holds as live (0185).
 * The photo behaviour is unchanged: the same sweep, the same intro-media listing, the same outcomes.
 *
 * S6-06 (CP2) — every step's outcome is VISIBLE as content-free telemetry (`INTRODUCTION_MEDIA_ERASURE` / sweep, erase,
 * reconcile; finite outcome classes only — never a key, handle, World, person or count as a label), so an erasure the
 * worker defers and retries is never silent. Telemetry is fail-soft: it can never fail or delay an erasure.
 */
@Injectable()
export class IntroductionMediaErasureWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private cycle = 0;

  constructor(
    private readonly repository: IntroductionDisclosureRepository,
    @Inject(INTRODUCTION_MEDIA_STORE) private readonly store: IntroductionMediaObjectStore,
    @Optional() private readonly telemetry?: TelemetryService,
    @Optional() @Inject(PRIVATE_AUDIO_OBJECT_STORE) private readonly audioStore?: PrivateAudioObjectStore,
    @Optional() private readonly voiceRepository?: VoiceMediaRepository,
  ) {}

  get enabled(): boolean {
    return this.store.isConfigured() && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
      && process.env.NODE_ENV !== 'test' && process.env.INTRODUCTION_MEDIA_ERASURE_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    const poll = Math.max(1000, Number(process.env.INTRODUCTION_MEDIA_ERASURE_POLL_MS ?? DEFAULT_POLL_MS) || DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), poll);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One cycle. Returns what it did, for the proof harness; never throws. */
  async runOnce(): Promise<{ swept: number; erased: number; deferred: number; enqueued: number }> {
    const result = { swept: 0, erased: 0, deferred: 0, enqueued: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      this.cycle += 1;
      try {
        const [swept] = await this.repository.sweep(SWEEP_LIMIT);
        result.swept = Number(swept?.swept_series ?? 0);
        this.signal('sweep', 'success');
      } catch {
        // The next cycle sweeps again; nothing was changed by a failed sweep.
        this.signal('sweep', 'transport_failure');
      }
      let claims: Array<{ storage_key: string; lease_id: string }> = [];
      try {
        claims = await this.repository.claimErasures(CLAIM_LIMIT, LEASE_SECONDS);
      } catch {
        claims = [];
        this.signal('erase', 'transport_failure');
      }
      for (const claim of claims) {
        if (await this.erase(claim.storage_key)) {
          try {
            await this.repository.confirmErased(claim.storage_key, claim.lease_id);
            result.erased += 1;
            this.signal('erase', 'success');
          } catch {
            // The lease expires and the key is claimed again; deleting a missing object is idempotent.
            this.signal('erase', 'transport_failure');
          }
        } else {
          try {
            await this.repository.deferErasure(claim.storage_key, claim.lease_id);
          } catch {
            // Likewise: an unexpired lease simply lapses.
          }
          result.deferred += 1;
          this.signal('erase', 'deferred');
        }
      }
      if (this.cycle % RECONCILE_EVERY === 1) result.enqueued = (await this.reconcile()) + (await this.reconcileVoice());
      return result;
    } finally {
      this.running = false;
    }
  }

  /** DELETE, then HEAD, in the store that holds the key's prefix: only an absence proven after the delete counts as erased. */
  async erase(key: string): Promise<boolean> {
    const store = isVoiceKey(key) ? this.audioStore : this.store;
    if (store === undefined) return false;
    try {
      await store.remove(key, AbortSignal.timeout(STORE_BUDGET_MS));
      return !(await store.exists(key, AbortSignal.timeout(STORE_BUDGET_MS)));
    } catch {
      return false;
    }
  }

  async reconcile(now: Date = new Date()): Promise<number> {
    let enqueued = 0;
    let continuation: string | null = null;
    const olderThan = new Date(now.getTime() - RECONCILE_GRACE_MS);
    try {
      do {
        const page = await this.store.listOlderThan(olderThan, continuation, AbortSignal.timeout(STORE_BUDGET_MS));
        if (page.keys.length > 0) {
          const [answer] = await this.repository.enqueueUnknown(page.keys);
          enqueued += Number(answer?.enqueued ?? 0);
        }
        continuation = page.next;
      } while (continuation !== null);
      this.signal('reconcile', 'success');
    } catch {
      // A failed listing is retried on the next reconciliation; the queue already holds every key the database released.
      this.signal('reconcile', 'transport_failure');
    }
    return enqueued;
  }

  /** S8B-02 (CP2): the listing reconciliation of each voice prefix (0185 decides what is no longer live). */
  async reconcileVoice(now: Date = new Date()): Promise<number> {
    if (this.audioStore === undefined || this.voiceRepository === undefined || !this.audioStore.isConfigured()) return 0;
    let enqueued = 0;
    const olderThan = new Date(now.getTime() - RECONCILE_GRACE_MS);
    try {
      for (const prefix of VOICE_KEY_PREFIXES) {
        let continuation: string | null = null;
        do {
          const page = await this.audioStore.listOlderThan(prefix, olderThan, continuation, AbortSignal.timeout(STORE_BUDGET_MS));
          if (page.keys.length > 0) enqueued += Number((await this.voiceRepository.enqueueUnknown(page.keys))?.enqueued ?? 0);
          continuation = page.next;
        } while (continuation !== null);
      }
      this.signal('voice_reconcile', 'success');
    } catch {
      // Retried on the next reconciliation; the queue already holds every key the database released.
      this.signal('voice_reconcile', 'transport_failure');
    }
    return enqueued;
  }

  /** One content-free outcome; a telemetry failure never reaches the erasure. */
  private signal(operation: 'sweep' | 'erase' | 'reconcile' | 'voice_reconcile', outcome: 'success' | 'deferred' | 'transport_failure'): void {
    try {
      this.telemetry?.recordOperationalOutcome('INTRODUCTION_MEDIA_ERASURE', operation, outcome);
    } catch {
      // Observability is best-effort.
    }
  }
}
