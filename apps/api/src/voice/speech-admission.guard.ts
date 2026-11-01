import type { SpeechSynthesisFailure } from './speech-synthesis.adapter';

/**
 * S8B-04 (CP1, contract v1.2 §9.3, AC-11) — the per-instance protection in front of the paid route. Provider-agnostic; the
 * route supplies its limits (Vertex: VERTEX_SPEECH_LIMITS, every value PROPOSED, a governed setting, not a capacity
 * measurement):
 *   - admission: at most 4 syntheses running and 8 waiting; a waiter gets a slot within 1 s or is refused;
 *   - a circuit breaker: 5 capacity / system errors within 60 s open it for 30 s; while open, every request is refused at
 *     once, before any database write or provider call.
 * A refusal is immediate and carries only its class. The per-user bound (one listen, two segments synthesizing) is the
 * database's (0187), so it holds across instances.
 */
export type AdmissionRefusal = 'QUEUE_FULL' | 'QUEUE_TIMEOUT' | 'CIRCUIT_OPEN';

export class SpeechAdmissionRefused extends Error {
  constructor(readonly refusal: AdmissionRefusal) {
    super(`SPEECH_ADMISSION_${refusal}`);
    this.name = 'SpeechAdmissionRefused';
  }
}

export type ReleaseSlot = () => void;

export interface SpeechAdmissionLimits {
  readonly maxInFlight: number;
  readonly maxQueued: number;
  readonly maxQueueWaitMs: number;
  readonly breakerErrors: number;
  readonly breakerWindowMs: number;
  readonly breakerOpenMs: number;
}

export class SpeechAdmissionGuard {
  private inFlight = 0;
  private readonly waiters: Array<{ grant: () => void }> = [];
  private errors: number[] = [];
  private openUntil = 0;

  constructor(private readonly limits: SpeechAdmissionLimits, private readonly now: () => number = Date.now) {}

  get circuitOpen(): boolean {
    return this.now() < this.openUntil;
  }

  /** A slot, or an immediate refusal (open breaker, full queue) or one after the bounded wait. */
  async enter(): Promise<ReleaseSlot> {
    if (this.circuitOpen) throw new SpeechAdmissionRefused('CIRCUIT_OPEN');
    if (this.inFlight < this.limits.maxInFlight) {
      this.inFlight += 1;
      return this.releaser();
    }
    if (this.waiters.length >= this.limits.maxQueued) throw new SpeechAdmissionRefused('QUEUE_FULL');
    return new Promise<ReleaseSlot>((resolve, reject) => {
      const waiter = {
        grant: () => {
          clearTimeout(timer);
          resolve(this.releaser());
        },
      };
      const timer = setTimeout(() => {
        const at = this.waiters.indexOf(waiter);
        if (at >= 0) this.waiters.splice(at, 1);
        reject(new SpeechAdmissionRefused('QUEUE_TIMEOUT'));
      }, this.limits.maxQueueWaitMs);
      this.waiters.push(waiter);
    });
  }

  /** Counts a failed attempt toward the breaker when it is a capacity or system error. */
  recordFailure(failure: SpeechSynthesisFailure): void {
    if (!failure.capacityOrSystem) return;
    const now = this.now();
    this.errors = this.errors.filter((t) => now - t < this.limits.breakerWindowMs);
    this.errors.push(now);
    if (this.errors.length >= this.limits.breakerErrors) {
      this.openUntil = now + this.limits.breakerOpenMs;
      this.errors = [];
    }
  }

  private releaser(): ReleaseSlot {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      // The slot passes straight to the next waiter (still counted in flight); otherwise it is freed.
      if (next) next.grant();
      else this.inFlight -= 1;
    };
  }
}
