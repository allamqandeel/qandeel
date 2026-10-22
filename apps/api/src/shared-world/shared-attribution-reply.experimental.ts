import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type {
  SharedQandeelReplyGenerator,
  SharedReplyGeneration,
  SharedReplyGenerationInput,
} from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import type { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import type { ModelRouter, ModelRouterContextMessage, ModelRouterRequest } from '../model-router/model-router.types';
import { type AttributionScan, type AttributionTier, attributionFacts, factNotes, renderAttributionNotes, scanAttribution } from './shared-attribution-notes.experimental';
import {
  type SharedAttributionReader, type VerifiedReading, attributionReadingInput, readingNotes, verifyAttributionReading,
} from './shared-attribution-reading.experimental';
import { assembleSharedConversationRequest } from './shared-conversation-model-input';

// S8A-02 CP2 — the attribution reply generator (S and R-DEEP). EXPERIMENTAL, evaluation only (Founder approval of
// `CP2_ATTRIBUTION_LAYER_DESIGN_CORRECTION.md`, 2026-10-22). Nothing in production imports this file, and it is bound to no
// module: production keeps `SharedConversationReplyGenerator`. R-2 is not implemented.
//
// Production's flow, unchanged in order: the Safety Response Gate first; then production's own Shared request. The layer
// only ADDS, and only when the gate finds an attribution marker (tier 1 or 2): the server's notes, in a data container at the
// end of the guidance (production would carry them in a request field of their own, a Controlled Amendment). On tier 0 the
// request is production's, byte for byte. In R-DEEP mode, and only on a turn production already routes DEEP, a reading call
// runs first under its own short budget; whatever happens to it (timeout, error, malformed or empty output), the reply goes on
// with the server's notes. The layer never withholds a reply and never asks the people anything by itself.

export type AttributionLayerMode = 'S' | 'R_DEEP';

export type ReadingState = 'NOT_NEEDED' | 'NOT_DEEP' | 'NO_READER' | 'VERIFIED' | 'EMPTY' | 'MALFORMED' | 'FAILED' | 'TIMED_OUT';

export interface AttributionObservation {
  readonly tier: AttributionTier;
  readonly readingState: ReadingState;
  readonly reading: VerifiedReading | null;
  readonly notes: string | null;
  readonly request: ModelRouterRequest;
  readonly timingsMs: { readonly scanAndFacts: number; readonly reading: number | null; readonly verifyAndRender: number };
}

export interface AttributionLayerOptions {
  readonly mode: AttributionLayerMode;
  readonly reader?: SharedAttributionReader;
  /**
   * Which turns R-DEEP reads on: `DEEP_ONLY` (the approved default: only a turn production already routes DEEP) or `ANY_RISK`
   * (any turn the gate flags, FAST or DEEP; Founder approval of the paid comparison, 2026-10-22: evaluation only, the S+R arm).
   * Neither changes the reply's route or budget.
   */
  readonly readOn?: 'DEEP_ONLY' | 'ANY_RISK';
  /** The reading call's own budget; it never changes the reply's production budget. To be measured before any choice. */
  readonly readingBudgetMs?: number;
  readonly observe?: (observation: AttributionObservation) => void;
}

/** The default reading budget for evaluation. Not a production value. */
export const EXPERIMENTAL_READING_BUDGET_MS = 4000;

const now = () => Number(process.hrtime.bigint()) / 1e6;

/** Production's request with the notes appended in their container, or production's request itself when there are none. */
export function withAttributionNotes(request: ModelRouterRequest, notes: string | null): ModelRouterRequest {
  return notes === null ? request : { ...request, behavioralGuidance: `${request.behavioralGuidance}\n\n${notes}` };
}

export class AttributionNotesReplyGenerator implements SharedQandeelReplyGenerator {
  constructor(
    private readonly router: ModelRouter,
    private readonly safety: SafetyResponseGateService,
    private readonly options: AttributionLayerOptions,
  ) {}

  async generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration> {
    const current = input.conversation.at(-1);
    if (current === undefined || current.producer !== 'HUMAN' || !hasTrustedProvenance(input.conversation)) return { state: 'UNAVAILABLE' };
    const earlier: ModelRouterContextMessage[] = input.conversation.slice(0, -1)
      .filter((turn) => turn.producer === 'HUMAN').map((turn) => ({ role: 'USER', content: turn.text }));
    const gate = this.safety.evaluate(current.text, [...earlier, { role: 'USER', content: current.text }]);
    if (gate.disposition === 'BLOCK') {
      return gate.deterministicResponse ? { state: 'GENERATED', text: gate.deterministicResponse } : { state: 'UNAVAILABLE' };
    }
    const production = assembleSharedConversationRequest(input.conversation, gate.disposition === 'GUIDED' ? gate.safetyGuidance : undefined);
    if (production === null) return { state: 'UNAVAILABLE' };

    return runWithAiUsageAttribution({ userId: input.requesterUserId }, async () => {
      const started = now();
      const scan = scanAttribution(input.conversation);
      const facts = scan.tier === 0 ? [] : factNotes(attributionFacts(scan));
      const scanned = now();
      const { state, reading, readingMs } = await this.read(scan, production);
      const rendering = now();
      const lines = reading === null ? facts : [...facts, ...readingNotes(reading, scan)];
      const notes = renderAttributionNotes(lines, scan.tier, scan.window.map((message) => message.messageRef));
      const request = withAttributionNotes(production, notes);
      this.options.observe?.({
        tier: scan.tier, readingState: state, reading, notes, request,
        timingsMs: { scanAndFacts: scanned - started, reading: readingMs, verifyAndRender: now() - rendering },
      });
      try {
        const result = await this.router.generate(request);
        return result.content.trim().length > 0 ? { state: 'GENERATED' as const, text: result.content } : { state: 'UNAVAILABLE' as const };
      } catch {
        return { state: 'UNAVAILABLE' as const };
      }
    });
  }

  private async read(scan: AttributionScan, production: ModelRouterRequest): Promise<{ state: ReadingState; reading: VerifiedReading | null; readingMs: number | null }> {
    if (scan.tier === 0) return { state: 'NOT_NEEDED', reading: null, readingMs: null };
    if (this.options.mode !== 'R_DEEP' || ((this.options.readOn ?? 'DEEP_ONLY') === 'DEEP_ONLY' && production.path !== 'DEEP')) return { state: 'NOT_DEEP', reading: null, readingMs: null };
    if (this.options.reader === undefined) return { state: 'NO_READER', reading: null, readingMs: null };
    const budget = this.options.readingBudgetMs ?? EXPERIMENTAL_READING_BUDGET_MS;
    const controller = new AbortController();
    const started = now();
    let timer: NodeJS.Timeout | undefined;
    try {
      const raw = await Promise.race([
        this.options.reader.read(attributionReadingInput(scan), controller.signal),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ReadingTimeout()); }, budget); }),
      ]);
      const reading = verifyAttributionReading(raw, scan);
      if (reading === null) return { state: 'MALFORMED', reading: null, readingMs: now() - started };
      return { state: reading.claims.length === 0 && reading.mentions.length === 0 ? 'EMPTY' : 'VERIFIED', reading, readingMs: now() - started };
    } catch (error) {
      return { state: error instanceof ReadingTimeout ? 'TIMED_OUT' : error instanceof Error && error.name === 'AttributionReadingMalformedError' ? 'MALFORMED' : 'FAILED', reading: null, readingMs: now() - started };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

class ReadingTimeout extends Error {}

const MESSAGE_REF = /^M[1-9][0-9]*$/u;
const SPEAKER_REF = /^S[1-9][0-9]*$/u;

/** The CP1 precondition the production generator enforces. */
function hasTrustedProvenance(conversation: SharedReplyGenerationInput['conversation']): boolean {
  const messages = new Set(conversation.map((turn) => turn.messageRef));
  return messages.size === conversation.length && conversation.every((turn) => MESSAGE_REF.test(turn.messageRef)
    && (turn.producer === 'HUMAN' ? typeof turn.speakerRef === 'string' && SPEAKER_REF.test(turn.speakerRef) : turn.speakerRef === null));
}
