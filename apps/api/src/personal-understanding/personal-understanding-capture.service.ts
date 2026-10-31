// S8A-03 CP2 — the background Personal Understanding capture (Founder option B).
//
// Two steps, split around the durable claim the dispatcher owns:
//   1. `prepare` - reads only: whether the current message is worth a proposal (a cheap deterministic pre-screen), the
//      bounded backfill of Memories whose semantic keys are not indexed yet, and, with a message, the current Memories the
//      duplicate screen needs, what QANDEEL already knows and the turns just before. Nothing to do means no claim and no
//      provider call. A read failure happens BEFORE the claim.
//   2. `propose` - the ONE provider call and the server's semantic verification. A provider failure (timeout,
//      unavailable, malformed answer) proposes nothing and indexes nothing, so the effect still completes and the backfill
//      simply runs again on a later turn; a provider answer never becomes a Memory without passing the verifier.
// It never writes: the dispatcher hands the verified command to the ONE atomic database command. Since Open Understanding
// (Product Owner decision 2026-10-24, CP2 amendment §10) that is capture schema v3 and migration 0173: DeepSeek reads the
// meaning; `personal-understanding-semantic.verifier.ts` proves grounding, ownership and structure.
//
// S8B-03 (CP1, E6 / E9 / E12, §4.9.3): a Voice Note turn is understood too. The database (capture v4) reads the turn's
// voice source and decides the source, the score and the operations; this service only keeps the command inside what
// v4 allows, so a voice turn never asks for what the database would refuse. LOW: backfill only - the unreliable text is
// never sent. MEDIUM: facts about the user and restatements only. HIGH: everything but a forget. A typed confirmation
// (M-03) comes only from a typed message, and only for an earlier MACHINE_ASR item.
import { Inject, Injectable, Optional } from '@nestjs/common';
import { TelemetryService } from '../observability/telemetry.service';
import type { BackgroundIntelligenceExecutionContext } from '../background-intelligence/background-intelligence-authority.service';
import { BackgroundIntelligenceEnrichmentService } from '../background-intelligence/background-intelligence-enrichment.service';
import { interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
import { interpretMemoryControl } from '../memory/memory-control.interpreter';
import { distinctiveWords } from '../memory/memory-control.resolution';
import { containsObviousSecret } from '../memory/memory-write-evaluator.service';
import type { MemoryRecord, MemoryType } from '../memory/memory.types';
import { MAX_UNDERSTANDING_MEMORY_CHARS } from './deepseek-personal-understanding-capture.provider';
import { verifyMemoryProposals } from './personal-understanding-capture.verifier';
import { verifySemanticCapture } from './personal-understanding-semantic.verifier';
import {
  MAX_UNDERSTANDING_BACKFILL,
  MAX_UNDERSTANDING_KNOWN_ITEMS,
  MAX_UNDERSTANDING_MESSAGE_CHARS,
  MAX_UNDERSTANDING_RECENT_TURN_CHARS,
  MAX_UNDERSTANDING_RECENT_TURNS,
  PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER,
  PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION_V3,
  type PersonalUnderstandingCaptureCommandV3,
  type PersonalUnderstandingCaptureProviderV3,
  type UnderstandingKnownItem,
  type UnderstandingRecentTurn,
  type VerifiedUnderstandingIndex,
} from './personal-understanding.types';

export interface PersonalUnderstandingCapturePlan {
  readonly message: string | null;
  readonly backlog: ReadonlyArray<{ readonly handle: string; readonly memoryId: string; readonly type: MemoryType; readonly content: string }>;
  /**
   * CP2 R3: backfill Memories that may never be sent to the provider (too long, or carrying a secret). They are settled
   * WITHOUT the model - a long one under its own words, a secret-bearing one under no term at all - so they leave the
   * bounded backfill window instead of holding it forever and starving every older eligible Memory.
   */
  readonly settle: ReadonlyArray<VerifiedUnderstandingIndex>;
  readonly current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'> & Partial<Pick<MemoryRecord, 'id' | 'subject'>>>;
  /**
   * Open Understanding, with a message only: what QANDEEL already knows (the owner's live SELF and OTHER Memories with
   * their person labels, handles k1-k40) and the completed turns just before the message. Empty without a message.
   */
  readonly known: ReadonlyArray<UnderstandingKnownItem>;
  readonly recentTurns: ReadonlyArray<UnderstandingRecentTurn>;
  /** S8B-03: the source turn's voice band; null for a typed turn. A LOW plan carries no message (backfill only). */
  readonly voiceBand?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

/**
 * The deterministic pre-screen. A message is sent for proposals unless it is a Memory or Interaction Preference command
 * (those are the foreground's), carries a secret (a secret is never sent to a provider) or is out of bounds. Open
 * Understanding (amendment §10): no first-person word list decides whether the model may read the message - the semantic
 * verifier decides what is kept, and whose it is.
 */
export function capturableMessage(content: string): string | null {
  const text = content.normalize('NFKC').trim();
  if (text.length < 4 || [...text].length > MAX_UNDERSTANDING_MESSAGE_CHARS) return null;
  if (isMemoryCommand(text) || interpretInteractionPreferenceCommand(text)) return null;
  if (containsObviousSecret(text)) return null;
  return text;
}

/**
 * S8A-03 CP3 D-2: a negation is not always a correction. «أنا مش بدخن خالص، ومش متجوز» has the shape of one («مش X، Y»)
 * but restates nothing, and the foreground already treats a correction whose old and new words share no distinctive word
 * as ordinary talk (memory-control.service, the same test); so it is the user's natural disclosure and is read here like
 * any other message. A correction that restates its predicate («مش ساكن في أكتوبر، ساكن في طنطا»), "I'm not X, I'm Y",
 * and every other Memory command stay the foreground's, exactly as before. The interpreter itself is unchanged.
 */
function isMemoryCommand(text: string): boolean {
  const intent = interpretMemoryControl(text);
  if (intent?.kind !== 'CORRECT' || intent.natural || intent.copula) return intent !== null;
  const replacement = distinctiveWords(intent.replacement);
  return [...distinctiveWords(intent.previous)].some((word) => replacement.has(word));
}

function knownAbout(item: UnderstandingKnownItem): string {
  if (item.subject === 'SELF') return 'USER';
  if (item.subject === 'UNATTRIBUTED') return 'NOT_RECORDED';
  const label = [item.personName, item.personRelation ? `(${item.personRelation})` : null].filter(Boolean).join(' ');
  return `OTHER: ${label || 'someone else'}`;
}

@Injectable()
export class PersonalUnderstandingCaptureService {
  constructor(
    private readonly data: BackgroundIntelligenceEnrichmentService,
    @Inject(PERSONAL_UNDERSTANDING_CAPTURE_PROVIDER) private readonly provider: PersonalUnderstandingCaptureProviderV3,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  async prepare(context: BackgroundIntelligenceExecutionContext, currentUserContent: string, now = new Date()): Promise<PersonalUnderstandingCapturePlan | undefined> {
    // S8B-03 (E12): a LOW voice turn calls the provider in the existing backfill mode only - its text is never sent.
    const voiceBand = (await this.data.readTurnVoiceProvenance?.(context))?.asrConfidenceBand ?? null;
    const message = voiceBand === 'LOW' ? null : capturableMessage(currentUserContent);
    const unindexed = await this.data.listUnindexedMemories(context, MAX_UNDERSTANDING_BACKFILL);
    const sendable = (memory: { readonly content: string }) =>
      memory.content.trim().length > 0 && [...memory.content].length <= MAX_UNDERSTANDING_MEMORY_CHARS && !containsObviousSecret(memory.content);
    const backlog = unindexed.filter(sendable).map((memory, index) => ({ handle: `m${index + 1}`, ...memory }));
    const settle = unindexed.filter((memory) => !sendable(memory)).map((memory) => {
      const [own] = verifyMemoryProposals([], [{ handle: '', ...memory }]);
      return containsObviousSecret(memory.content) ? { ...own, terms: [] } : own;
    });
    if (message === null && backlog.length === 0 && settle.length === 0) return undefined;
    if (message === null) return { message, backlog, settle, current: [], known: [], recentTurns: [], ...(voiceBand ? { voiceBand } : {}) };
    const current = await this.data.listCaptureScreenMemories(context, now);
    const known = (await this.data.listKnownMemories(context, MAX_UNDERSTANDING_KNOWN_ITEMS))
      .filter(sendable).slice(0, MAX_UNDERSTANDING_KNOWN_ITEMS).map((memory, index) => ({ handle: `k${index + 1}`, ...memory }));
    // A turn carrying a secret is never sent. QANDEEL's own turns are context only: they never ground a fact or a person.
    const recentTurns = (await this.data.listRecentTurns(context, MAX_UNDERSTANDING_RECENT_TURNS))
      .filter((turn) => !containsObviousSecret(turn.content))
      .map((turn) => ({ role: turn.role === 'USER' ? 'USER' as const : 'QANDEEL' as const,
        content: [...turn.content].slice(0, MAX_UNDERSTANDING_RECENT_TURN_CHARS).join('') }));
    return { message, backlog, settle, current, known, recentTurns, ...(voiceBand ? { voiceBand } : {}) };
  }

  async propose(plan: PersonalUnderstandingCapturePlan, now = new Date()): Promise<PersonalUnderstandingCaptureCommandV3> {
    const empty = (index: PersonalUnderstandingCaptureCommandV3['index'], audit: PersonalUnderstandingCaptureCommandV3['audit'] = []): PersonalUnderstandingCaptureCommandV3 =>
      ({ items: [], index, reaffirmed: [], ended: [], forget: [], corrections: [], audit });
    // CP2 R3: settling needs no model, so a plan with nothing to send makes no provider call at all.
    if (plan.message === null && plan.backlog.length === 0) return empty([...plan.settle]);
    let output;
    try {
      output = await this.provider.captureV3({
        schemaVersion: PERSONAL_UNDERSTANDING_CAPTURE_SCHEMA_VERSION_V3,
        currentUserText: plan.message,
        recentTurns: plan.message === null ? [] : [...plan.recentTurns],
        memories: plan.backlog.map((memory) => ({ handle: memory.handle, type: memory.type, content: memory.content })),
        known: plan.message === null ? [] : plan.known.map((item) => ({ handle: item.handle, type: item.type, content: item.content,
          about: knownAbout(item), temporal: item.temporal, ended: item.ended, source: item.source, confirmedByTyping: item.confirmedByTyping })),
        ...(plan.message !== null && (plan.voiceBand === 'HIGH' || plan.voiceBand === 'MEDIUM') ? { voiceBand: plan.voiceBand } : {}),
      });
    } catch {
      return empty([...plan.settle], [{ part: 'fact', index: -1, verdict: 'PROVIDER_FAILED' }]);
    }
    const index = [...verifyMemoryProposals(output.memories, plan.backlog), ...plan.settle];
    if (plan.message === null) return empty(index);
    const result = verifySemanticCapture(output, { message: plan.message, recentTurns: plan.recentTurns, known: plan.known, current: plan.current, now });
    const verified: PersonalUnderstandingCaptureCommandV3 = { items: result.items, index, reaffirmed: result.reaffirmed, ended: result.ended, forget: result.forget,
      corrections: result.corrections, audit: result.audit, confirmed: plan.voiceBand ? [] : confirmedKnownIds(output.confirmedKnown, plan.known, result) };
    return this.withinVoiceBand(verified, plan.voiceBand ?? null);
  }

  /**
   * S8B-03 (§4.9.3): what capture v4 allows for this turn's band, and nothing more. A withheld operation is counted (one
   * content-free class), never logged. A typed turn passes unchanged.
   */
  withinVoiceBand(command: PersonalUnderstandingCaptureCommandV3, band: 'HIGH' | 'MEDIUM' | 'LOW' | null): PersonalUnderstandingCaptureCommandV3 {
    if (band === null) return command;
    const keep = band === 'LOW'
      ? { items: [], reaffirmed: [], ended: [], corrections: [] }
      : band === 'MEDIUM'
        ? { items: command.items.filter((item) => item.subject !== 'OTHER'), reaffirmed: command.reaffirmed, ended: [], corrections: [] }
        : { items: command.items, reaffirmed: command.reaffirmed, ended: command.ended, corrections: command.corrections };
    const withheld = (command.items.length - keep.items.length) + (command.reaffirmed.length - keep.reaffirmed.length)
      + (command.ended.length - keep.ended.length) + (command.corrections.length - keep.corrections.length) + command.forget.length
      + (command.confirmed?.length ?? 0);
    for (let i = 0; i < withheld; i += 1) this.withheld();
    const kept = new Set([...keep.items, ...keep.corrections].map((entry) => entry.memoryId));
    return { ...command, ...keep, forget: [], confirmed: [], index: command.index.filter((entry) => !isNewEntry(command, entry.memoryId) || kept.has(entry.memoryId)) };
  }

  /** S8B-03 (E11): the same command without facts about someone else - when the database refused a person label. */
  withoutOtherPeople(command: PersonalUnderstandingCaptureCommandV3): PersonalUnderstandingCaptureCommandV3 {
    const items = command.items.filter((item) => item.subject !== 'OTHER');
    for (let i = 0; i < command.items.length - items.length; i += 1) this.withheld();
    const kept = new Set([...items, ...command.corrections].map((entry) => entry.memoryId));
    return { ...command, items, index: command.index.filter((entry) => !isNewEntry(command, entry.memoryId) || kept.has(entry.memoryId)) };
  }

  private withheld(): void {
    try {
      this.telemetry?.recordOperationalOutcome('VOICE_CAPTURE_OPERATION_WITHHELD', 'capture', 'withheld');
    } catch {
      // Observability is best-effort.
    }
  }
}

/** Whether an index entry belongs to a NEW Memory of this command (an item or a correction), not to a backfilled one. */
function isNewEntry(command: PersonalUnderstandingCaptureCommandV3, memoryId: string): boolean {
  return command.items.some((item) => item.memoryId === memoryId) || command.corrections.some((entry) => entry.memoryId === memoryId);
}

/**
 * S8B-03 (E9, M-03): the known items a typed message explicitly confirmed - only earlier MACHINE_ASR items, never one this
 * command also ends, forgets or corrects, at most three. The database re-checks every condition (0186 v4).
 */
function confirmedKnownIds(handles: readonly string[] | undefined, known: ReadonlyArray<UnderstandingKnownItem>,
  result: { readonly ended: readonly string[]; readonly forget: readonly string[]; readonly corrections: ReadonlyArray<{ readonly targetMemoryId: string }> }): string[] {
  const touched = new Set([...result.ended, ...result.forget, ...result.corrections.map((c) => c.targetMemoryId)]);
  const ids = (handles ?? []).map((handle) => known.find((item) => item.handle === handle))
    .filter((item): item is UnderstandingKnownItem => item !== undefined && item.source === 'MACHINE_ASR' && !touched.has(item.memoryId))
    .map((item) => item.memoryId);
  return [...new Set(ids)].slice(0, 3);
}
