import type { SharedReplyGenerationTurn } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import type { ModelRouterRequest } from '../model-router/model-router.types';
import { type AttributionScan, type AttributionTier, attributionFacts, factNotes, renderAttributionNotes, scanAttribution } from './shared-attribution-notes';
import { type SharedAttributionReader, type VerifiedReading, attributionReadingInput, readingNotes, verifyAttributionReading } from './shared-attribution-reading';

// S8A-02 CP2 — the Shared attribution layer (Founder product decision, 2026-10-23: option (b); S8A-02 CP2 Shared Attribution
// Layer Controlled Amendment, CA-S1 / CA-S2 / CA-S3). The Shared reply generator calls it AFTER the Safety Response Gate (a
// BLOCK never reaches it) and after the one Shared assembler, inside the requester's AI-COST-01 scope, so the reading is an
// accounted provider call like the reply:
//
//   tier 0 (no attribution marker in the window): production's request, the same object, untouched (B);
//   tier 1 / 2: one attribution reading under its own 2.5 s budget, then the reply carrying the server's notes — the facts
//   always, the verified readings when the reading succeeded (S+R). A reading that fails, times out, is malformed or empty
//   leaves the facts alone (S); it is never retried and never withholds the reply.
//
// The reply's budget is what remains of the reading turn's total (FAST 6 s, DEEP its unchanged 10 s), measured from the start
// of the layer, so reading and reply together never pass it. The general FAST / DEEP budgets of every other turn are unchanged.
// Pure apart from the reader; nothing is logged or kept.

/** The reading call's own budget (CA-S1): Round 10 tier-1/2 readings, p95 2.39 s, 67 of 69 within 2.5 s. */
export const SHARED_ATTRIBUTION_READING_BUDGET_MS = 2_500;
/** The whole reading turn, reading plus reply (CA-S1). DEEP keeps the general Shared DEEP budget. */
export const SHARED_ATTRIBUTION_TURN_BUDGET_MS = { FAST: 6_000, DEEP: 10_000 } as const;

export type SharedAttributionReadingState = 'NOT_NEEDED' | 'VERIFIED' | 'EMPTY' | 'MALFORMED' | 'FAILED' | 'TIMED_OUT';

export interface SharedAttributionOutcome {
  /** The reply request: production's own on tier 0; otherwise with the notes and the remaining turn budget. */
  readonly request: ModelRouterRequest;
  readonly tier: AttributionTier;
  readonly readingState: SharedAttributionReadingState;
}

const monotonic = () => Number(process.hrtime.bigint()) / 1e6;

export async function withSharedAttribution(
  conversation: ReadonlyArray<SharedReplyGenerationTurn>, request: ModelRouterRequest, reader: SharedAttributionReader, now: () => number = monotonic,
): Promise<SharedAttributionOutcome> {
  const started = now();
  let scan: AttributionScan;
  let facts: ReturnType<typeof factNotes>;
  try {
    scan = scanAttribution(conversation);
    if (scan.tier === 0) return { request, tier: 0, readingState: 'NOT_NEEDED' };
    facts = factNotes(attributionFacts(scan));
  } catch {
    // A defect in the deterministic scan never costs the people their reply: production's request goes as it is.
    return { request, tier: 0, readingState: 'NOT_NEEDED' };
  }
  const { state, reading } = await readWithinBudget(scan, reader);
  const lines = reading === null ? facts : [...facts, ...readingNotes(reading, scan)];
  const notes = renderAttributionNotes(lines, scan.tier, scan.window.map((message) => message.messageRef));
  const remaining = Math.max(0, Math.floor(SHARED_ATTRIBUTION_TURN_BUDGET_MS[request.path] - (now() - started)));
  const withNotes = notes === null ? request : { ...request, behavioralGuidance: `${request.behavioralGuidance}\n\n${notes}` };
  return { request: { ...withNotes, latencyBudgetMs: remaining }, tier: scan.tier, readingState: state };
}

class ReadingTimeout extends Error {}

async function readWithinBudget(scan: AttributionScan, reader: SharedAttributionReader): Promise<{ state: SharedAttributionReadingState; reading: VerifiedReading | null }> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    const raw = await Promise.race([
      reader.read(attributionReadingInput(scan), controller.signal),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ReadingTimeout()); }, SHARED_ATTRIBUTION_READING_BUDGET_MS); }),
    ]);
    const reading = verifyAttributionReading(raw, scan);
    if (reading === null) return { state: 'MALFORMED', reading: null };
    return { state: reading.claims.length === 0 && reading.mentions.length === 0 ? 'EMPTY' : 'VERIFIED', reading };
  } catch (error) {
    if (error instanceof ReadingTimeout) return { state: 'TIMED_OUT', reading: null };
    return { state: error instanceof Error && error.name === 'AttributionReadingMalformedError' ? 'MALFORMED' : 'FAILED', reading: null };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
