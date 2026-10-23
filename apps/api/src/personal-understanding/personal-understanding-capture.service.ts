// S8A-03 CP2 — the background Personal Understanding capture (Founder option B).
//
// Two steps, split around the durable claim the dispatcher owns:
//   1. `prepare` - reads only: whether the current message is worth a proposal (a cheap deterministic pre-screen), the
//      bounded backfill of Memories whose semantic keys are not indexed yet, and the current Memories the duplicate /
//      reversal screen needs. Nothing to do means no claim and no provider call. A read failure happens BEFORE the claim.
//   2. `propose` - the ONE provider call and the deterministic verification. A provider failure (timeout, unavailable,
//      malformed answer) proposes nothing and indexes nothing, so the effect still completes and the backfill simply
//      runs again on a later turn; a provider answer never becomes a Memory without passing the verifier.
// It never writes: the dispatcher hands the verified command to the ONE atomic 0171 database command.
import { Inject, Injectable } from '@nestjs/common';
import type { BackgroundIntelligenceExecutionContext } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceEnrichmentService } from '../background-intelligence/background-intelligence-enrichment.service';
import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { interpretMemoryControl } from '../memory/memory-control.interpreter';
import { containsObviousSecret } from '../memory/memory-write-evaluator.service';
import type { MemoryRecord, MemoryType } from '../memory/memory.types';
import { MAX_UNDERSTANDING_MEMORY_CHARS } from './deepseek-personal-understanding-capture.provider';
import { carriesFirstPersonSignal, verifyFactProposals, verifyMemoryProposals } from './personal-understanding-capture.verifier';
import {
  MAX_UNDERSTANDING_BACKFILL,
  MAX_UNDERSTANDING_MESSAGE_CHARS,
  PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER,
  PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION,
  type PersonalUnderstandingCaptureCommand,
  type PersonalUnderstandingCaptureProvider,
} from './personal-understanding.types';

export interface PersonalUnderstandingCapturePlan {
  readonly message: string | null;
  readonly backlog: ReadonlyArray<{ readonly handle: string; readonly memoryId: string; readonly type: MemoryType; readonly content: string }>;
  readonly current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'>>;
}

/**
 * The deterministic pre-screen. A message is sent for proposals only when it could state something about the user: it
 * is not a Memory or Interaction Preference command (those are the foreground's), carries no secret (a secret is never
 * sent to a provider), is within bounds, and carries any first-person signal at all. It is deliberately broad - every
 * proposal is verified afterwards - so ordinary sentences are not lost the way the closed 01A grammar loses them.
 */
export function capturableMessage(content: string): string | null {
  const text = content.normalize('NFKC').trim();
  if (text.length < 4 || [...text].length > MAX_UNDERSTANDING_MESSAGE_CHARS) return null;
  if (interpretMemoryControl(text) || interpretInteractionPreferenceCommand(text)) return null;
  if (containsObviousSecret(text) || !carriesFirstPersonSignal(text)) return null;
  return text;
}

@Injectable()
export class PersonalUnderstandingCaptureService {
  constructor(
    private readonly data: BackgroundIntelligenceEnrichmentService,
    @Inject(PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER) private readonly provider: PersonalUnderstandingCaptureProvider,
  ) {}

  async prepare(context: BackgroundIntelligenceExecutionContext, currentUserContent: string, now = new Date()): Promise<PersonalUnderstandingCapturePlan | undefined> {
    const message = capturableMessage(currentUserContent);
    const backlog = (await this.data.listUnindexedMemories(context, MAX_UNDERSTANDING_BACKFILL))
      .filter((memory) => memory.content.trim().length > 0 && [...memory.content].length <= MAX_UNDERSTANDING_MEMORY_CHARS && !containsObviousSecret(memory.content))
      .map((memory, index) => ({ handle: `m${index + 1}`, ...memory }));
    if (message === null && backlog.length === 0) return undefined;
    const current = message === null ? [] : await this.data.listCaptureScreenMemories(context, now);
    return { message, backlog, current };
  }

  async propose(plan: PersonalUnderstandingCapturePlan, now = new Date()): Promise<PersonalUnderstandingCaptureCommand> {
    let output;
    try {
      output = await this.provider.capture({
        schemaVersion: PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION,
        currentUserText: plan.message,
        memories: plan.backlog.map((memory) => ({ handle: memory.handle, type: memory.type, content: memory.content })),
      });
    } catch {
      return { items: [], index: [] };
    }
    const items = plan.message === null ? [] : verifyFactProposals(output.facts, plan.message, plan.current, now).kept;
    return { items, index: verifyMemoryProposals(output.memories, plan.backlog) };
  }
}
