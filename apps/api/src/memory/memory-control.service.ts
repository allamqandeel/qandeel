import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { MemoryRecord, MemoryType } from './memory.types';
import { MemoryControlRepository } from './memory-control.repository';
import { MemoryWriteEvaluatorService, normalizeMemoryContent } from './memory-write-evaluator.service';
import {
  interpretMemoryControl, memoryControlLanguage, readClarificationAnswer,
  type ClarificationAnswer, type MemoryControlIntent,
} from './memory-control.interpreter';
import { distinctiveWords, resolveMemoryTarget, type MemoryTargetResolution } from './memory-control.resolution';
import {
  alreadyCorrectReply, alreadyRememberedReply, clarificationReply, correctedReply, disabledReply, forgottenReply,
  inspectReply, plainReply, rememberedReply, type MemoryControlLanguage,
} from './memory-control.copy';
import type { MemoryControlKind, MemoryControlPlan, PendingMemoryClarification } from './memory-control.types';

const INSPECT_RELIED_SHOWN = 8;
const INSPECT_NOT_RELIED_SHOWN = 4;

export interface MemoryControlTurn {
  accessToken: string;
  userId: string;
  sessionId: string;
  sourceTurnId: string;
  content: string;
  /** The immediately preceding user words of this Session from the canonical context, when there are any. */
  previousUserContent?: string;
}

/**
 * W3-MEGA-M (E2E-D-13) — the ONE Memory-control boundary of a Conversation turn.
 *
 * `plan` answers `null` for everything that is not an explicit Memory request, and the turn continues exactly as
 * before. Otherwise it returns a fully decided plan — kind, requested outcome, the canonical target / candidates read
 * with the caller's own token, and the reply for that outcome — which the Conversation orchestrator hands to the one
 * atomic database command. Nothing is written here, no provider is called, and no Memory id ever comes from the
 * user's words: ids come only from owner-scoped canonical reads, and the database re-checks every target under a row
 * lock. A read failure on an explicit command propagates (the turn fails closed and nothing is fabricated); a failure
 * of the optional "is a clarification pending?" read only means the short reply is ordinary conversation.
 */
@Injectable()
export class MemoryControlService {
  constructor(
    private readonly repository: MemoryControlRepository,
    private readonly evaluator: MemoryWriteEvaluatorService,
  ) {}

  async plan(turn: MemoryControlTurn, now = new Date()): Promise<MemoryControlPlan | null> {
    const intent = interpretMemoryControl(turn.content);
    if (intent) {
      const planned = await this.planCommand(turn, intent, now);
      if (planned) return planned;
    }
    // «انسى التانية» / "forget the second one" names no Memory by itself, but it may answer the question just asked.
    const answer = readClarificationAnswer(turn.content);
    if (!answer) return null;
    let pending: PendingMemoryClarification | undefined;
    try {
      pending = await this.repository.findPendingClarification(turn.accessToken, turn.sessionId, turn.sourceTurnId);
    } catch {
      return null;
    }
    return pending ? this.planAnswer(turn, pending, answer, now) : null;
  }

  private async planCommand(turn: MemoryControlTurn, intent: MemoryControlIntent, now: Date): Promise<MemoryControlPlan | null> {
    const language = memoryControlLanguage(turn.content, turn.previousUserContent);
    const rows = await this.repository.listControllable(turn.accessToken, turn.userId);
    const current = rows.filter((memory) => memory.user_id === turn.userId && isCurrent(memory, now));
    const disabled = rows.filter((memory) => memory.user_id === turn.userId && memory.status === 'DISABLED');

    switch (intent.kind) {
      case 'INSPECT': {
        const relied = current.slice(0, INSPECT_RELIED_SHOWN).map(({ content }) => content);
        const notRelied = disabled.slice(0, INSPECT_NOT_RELIED_SHOWN).map(({ content }) => content);
        return {
          kind: 'INSPECT', outcome: relied.length + notRelied.length > 0 ? 'INSPECTED' : 'NOTHING_REMEMBERED',
          candidateMemoryIds: [], reply: inspectReply(language, relied, notRelied, current.length > INSPECT_RELIED_SHOWN),
        };
      }
      case 'REMEMBER': {
        const decision = this.evaluator.explicitStatementCandidate(intent.statement, now);
        if (decision.decision === 'SKIP') {
          return decision.reason === 'SENSITIVE_DATA'
            ? { kind: 'REMEMBER', outcome: 'DECLINED_SENSITIVE', candidateMemoryIds: [], reply: plainReply(language, 'DECLINED_SENSITIVE') }
            : null;
        }
        const existing = current.find((memory) => normalizeMemoryContent(memory.content) === normalizeMemoryContent(decision.candidate.content));
        if (existing) {
          return { kind: 'REMEMBER', outcome: 'ALREADY_REMEMBERED', candidateMemoryIds: [], reply: alreadyRememberedReply(language, existing.content) };
        }
        const { type, content, confidence, importance, expiresAt } = decision.candidate;
        return {
          kind: 'REMEMBER', outcome: 'REMEMBERED', candidateMemoryIds: [],
          newMemory: { id: randomUUID(), type, content, confidence, importance, ...(expiresAt ? { expiresAt } : {}) },
          reply: rememberedReply(language, content),
        };
      }
      case 'CORRECT': {
        // A correction restates the SAME predicate with a new value («ساكن في أكتوبر» → «ساكن في طنطا», "live in …" →
        // "live in …", or "I'm X" → "I'm Y"). "I don't like my job, but I need the money" restates nothing: ordinary talk.
        const shared = new Set([...distinctiveWords(intent.previous)].filter((word) => distinctiveWords(intent.replacement).has(word)));
        if (shared.size === 0 && !intent.copula) return null;
        const replacement = this.evaluator.explicitStatementCandidate(intent.replacement, now);
        const replacementKey = replacement.decision === 'WRITE' ? normalizeMemoryContent(replacement.candidate.content) : undefined;
        // A Memory that already says the new thing is not what is being corrected.
        const correctable = current.filter((memory) => normalizeMemoryContent(memory.content) !== replacementKey);
        const resolution = resolveMemoryTarget(intent.previous, correctable, shared);
        if (resolution.state === 'RESOLVED') return this.correction(language, resolution.memory, intent.replacement, now);
        const existing = replacementKey === undefined ? undefined : current.find((memory) => normalizeMemoryContent(memory.content) === replacementKey);
        if (existing) return { kind: 'CORRECT', outcome: 'ALREADY_CORRECT', candidateMemoryIds: [], reply: alreadyCorrectReply(language, existing.content) };
        if (resolution.state === 'AMBIGUOUS') {
          if (replacement.decision === 'SKIP' && replacement.reason === 'SENSITIVE_DATA') {
            return { kind: 'CORRECT', outcome: 'DECLINED_SENSITIVE', candidateMemoryIds: [], reply: plainReply(language, 'DECLINED_SENSITIVE') };
          }
          return clarification('CORRECT', language, resolution.options);
        }
        // Nothing remembered fully matches the old words: an ordinary statement, not a Memory command.
        return null;
      }
      case 'FORGET':
      case 'DISABLE': {
        const candidates = [...current, ...disabled];
        let resolution = resolveMemoryTarget(intent.target, candidates);
        if (resolution.state === 'UNSPECIFIED' && intent.kind === 'DISABLE' && intent.alternateTarget) {
          resolution = resolveMemoryTarget(intent.alternateTarget, candidates);
        }
        // Words not anchored to Memory («امسح موضوع الشغل», "forget the work stuff") count only on a full match; anything
        // less stays ordinary conversation, so "forget about work, let's talk movies" is never a Memory question.
        const soft = intent.kind === 'FORGET' && intent.strength === 'SOFT';
        if (soft && resolution.state !== 'RESOLVED' && resolution.state !== 'AMBIGUOUS') return null;
        if (resolution.state === 'UNSPECIFIED') return this.deictic(intent.kind, language, turn.previousUserContent, candidates);
        if (resolution.state === 'AMBIGUOUS' || resolution.state === 'PARTIAL') return clarification(intent.kind, language, resolution.options);
        if (resolution.state === 'NONE') {
          return { kind: intent.kind, outcome: 'TARGET_NOT_FOUND', candidateMemoryIds: [], reply: plainReply(language, 'TARGET_NOT_FOUND') };
        }
        // Unanchored words that happen to match one Memory («امسح الصورة») are confirmed, never acted on directly.
        if (soft) return clarification(intent.kind, language, [resolution.memory]);
        return lifecycleChange(intent.kind, language, resolution.memory);
      }
    }
  }

  /**
   * "That information" names nothing by itself. The words of the previous user turn may point at something
   * remembered, but a pointer is never enough to change Memory: QANDEEL always asks first, even for one match.
   */
  private deictic(
    kind: 'FORGET' | 'DISABLE', language: MemoryControlLanguage, previousUserContent: string | undefined,
    candidates: ReadonlyArray<MemoryRecord>,
  ): MemoryControlPlan {
    const pointed: MemoryTargetResolution = previousUserContent ? resolveMemoryTarget(previousUserContent, candidates) : { state: 'NONE' };
    if (pointed.state === 'RESOLVED') return clarification(kind, language, [pointed.memory]);
    if (pointed.state === 'AMBIGUOUS' || pointed.state === 'PARTIAL') return clarification(kind, language, pointed.options);
    return { kind, outcome: 'TARGET_NOT_SPECIFIED', candidateMemoryIds: [], reply: plainReply(language, 'TARGET_NOT_SPECIFIED') };
  }

  private correction(
    language: MemoryControlLanguage, target: MemoryRecord, replacementWords: string, now: Date, answersCommandId?: string,
  ): MemoryControlPlan | null {
    const decision = this.evaluator.explicitStatementCandidate(replacementWords, now, fallbackType(target.type));
    const answering = answersCommandId ? { answersCommandId } : {};
    if (decision.decision === 'SKIP') {
      return decision.reason === 'SENSITIVE_DATA'
        ? { kind: 'CORRECT', outcome: 'DECLINED_SENSITIVE', candidateMemoryIds: [], ...answering, reply: plainReply(language, 'DECLINED_SENSITIVE') }
        : null;
    }
    const { type, content, confidence, importance, expiresAt } = decision.candidate;
    return {
      kind: 'CORRECT', outcome: 'CORRECTED', targetMemoryId: target.id, candidateMemoryIds: [], ...answering,
      newMemory: { id: randomUUID(), type, content, confidence, importance, ...(expiresAt ? { expiresAt } : {}) },
      reply: correctedReply(language, target.content, content),
      replyIfChanged: plainReply(language, 'TARGET_CHANGED'),
    };
  }

  private async planAnswer(
    turn: MemoryControlTurn, pending: PendingMemoryClarification, answer: ClarificationAnswer, now: Date,
  ): Promise<MemoryControlPlan | null> {
    const language = memoryControlLanguage(turn.content, pending.clarifiedTurnContent);
    const owned = await this.repository.findOwned(turn.accessToken, turn.userId, pending.candidateMemoryIds);
    const byId = new Map(owned.filter((memory) => memory.user_id === turn.userId).map((memory) => [memory.id, memory]));
    const options = pending.candidateMemoryIds.map((id) => byId.get(id)).filter((memory): memory is MemoryRecord => memory !== undefined);
    if (options.length === 0) return null;
    const answering = { answersCommandId: pending.commandId };
    const askAgain = (oneAtATime = false): MemoryControlPlan => ({
      ...clarification(pending.kind, language, options, oneAtATime), ...answering,
    });

    let chosen: MemoryRecord | undefined;
    switch (answer.type) {
      case 'NO':
        return { kind: pending.kind, outcome: 'CLARIFICATION_DECLINED', candidateMemoryIds: [], ...answering, reply: plainReply(language, 'CLARIFICATION_DECLINED') };
      case 'ALL':
        if (options.length > 1) return askAgain(true);
        chosen = options[0];
        break;
      case 'YES':
        if (options.length > 1) return askAgain();
        chosen = options[0];
        break;
      case 'OPTION':
        if (answer.index >= options.length) return askAgain();
        chosen = options[answer.index];
        break;
      case 'WORDS': {
        const resolution = resolveMemoryTarget(answer.text, options);
        if (resolution.state !== 'RESOLVED') return null;
        chosen = resolution.memory;
        break;
      }
    }

    if (pending.kind === 'CORRECT') {
      const original = interpretMemoryControl(pending.clarifiedTurnContent);
      if (original?.kind !== 'CORRECT') return null;
      return this.correction(language, chosen, original.replacement, now, pending.commandId);
    }
    return { ...lifecycleChange(pending.kind, language, chosen), ...answering };
  }
}

function isCurrent(memory: MemoryRecord, now: Date): boolean {
  return memory.status === 'ACTIVE' && (memory.expires_at === null || new Date(memory.expires_at).getTime() > now.getTime());
}

function fallbackType(type: MemoryType): Exclude<MemoryType, 'DERIVED_INSIGHT'> {
  return type === 'DERIVED_INSIGHT' ? 'PERSONAL_FACT' : type;
}

function clarification(
  kind: Exclude<MemoryControlKind, 'INSPECT' | 'REMEMBER'>, language: MemoryControlLanguage,
  options: ReadonlyArray<MemoryRecord>, oneAtATime = false,
): MemoryControlPlan {
  return {
    kind, outcome: 'CLARIFICATION_REQUIRED', candidateMemoryIds: options.map(({ id }) => id),
    reply: clarificationReply(language, options.map(({ content }) => content), oneAtATime),
  };
}

function lifecycleChange(kind: 'FORGET' | 'DISABLE', language: MemoryControlLanguage, target: MemoryRecord): MemoryControlPlan {
  return kind === 'FORGET'
    ? { kind, outcome: 'FORGOTTEN', targetMemoryId: target.id, candidateMemoryIds: [], reply: forgottenReply(language, target.content), replyIfChanged: plainReply(language, 'TARGET_CHANGED') }
    : { kind, outcome: 'DISABLED', targetMemoryId: target.id, candidateMemoryIds: [], reply: disabledReply(language, target.content), replyIfChanged: plainReply(language, 'TARGET_CHANGED') };
}
