import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readMemorySubject } from '../memory/memory-subject';
import { interpretLegacyInteractionPreference } from './interaction-preference-command.interpreter';
import { interactionPreferenceReply } from './interaction-preference.copy';
import { InteractionPreferencesRepository } from './interaction-preferences.repository';
import {
  DEFAULT_INTERACTION_PREFERENCES, INTERACTION_PREFERENCE_OUTCOMES, PREFERENCE_KEY, isPreferenceField, isPreferenceValue,
  type InteractionPreferenceCommand, type InteractionPreferenceCommandPlan, type InteractionPreferenceField,
  type InteractionPreferenceOutcome, type InteractionPreferenceRecord, type InteractionPreferences,
  type InteractionPreferenceValue, type LegacyReviewOutcome,
} from './interaction-preferences.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface InteractionPreferencesView {
  readonly preferences: InteractionPreferences;
  readonly version: number;
}
export interface InteractionPreferenceChangeView extends InteractionPreferencesView {
  readonly outcome: InteractionPreferenceOutcome;
}
export interface LegacyReviewCandidateView {
  readonly memoryId: string;
  /** The owner's own remembered words, shown so the owner decides; never rewritten. */
  readonly statement: string;
  readonly field: InteractionPreferenceField;
  readonly value: InteractionPreferenceValue;
  /** True when adopting it would replace a different preference the owner already chose for that field. */
  readonly replacesCurrent: boolean;
}
export interface LegacyReviewView extends InteractionPreferencesView {
  readonly candidates: readonly LegacyReviewCandidateView[];
}
export interface LegacyReviewApplyView extends InteractionPreferencesView {
  readonly outcome: LegacyReviewOutcome;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) invalid();
};
const expectedVersionOf = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : invalid();

/**
 * IP-IMP-01 — the canonical Interaction Preferences authority (migration 0153), as the API sees it.
 *
 *  * `readForTurn` is the bounded owner-scoped read every eligible Personal conversation turn takes. It never degrades:
 *    an upstream failure or a malformed answer THROWS, and the orchestrator fails the turn closed with zero provider
 *    calls. An absent row is the legitimate "no durable declaration" (all DEFAULT, version 0).
 *  * `planCommand` turns a recognised durable conversation command into the change, the version it was planned
 *    against and the reply for every outcome the database may commit.
 *  * The Settings and legacy-review methods back the owner's REST routes.
 */
@Injectable()
export class InteractionPreferencesService {
  constructor(private readonly repository: InteractionPreferencesRepository) {}

  async readForTurn(accessToken: string, userId: string): Promise<InteractionPreferenceRecord> {
    return this.readRecord(accessToken, userId);
  }

  async planCommand(accessToken: string, userId: string, command: InteractionPreferenceCommand): Promise<InteractionPreferenceCommandPlan> {
    const current = await this.readRecord(accessToken, userId);
    const reply = (outcome: InteractionPreferenceOutcome) => interactionPreferenceReply(command.language, outcome, command.field, command.value);
    return {
      field: command.field, value: command.value, expectedVersion: current.version,
      replyIfSaved: reply('SAVED'), replyIfUnchanged: reply('UNCHANGED'), replyIfStale: reply('STALE'),
    };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Settings (WP5) and the optional legacy review (WP3).
  // ------------------------------------------------------------------------------------------------------------------

  async view(userId: string, token: string): Promise<InteractionPreferencesView> {
    return this.guard(() => this.readRecord(token, userId));
  }

  /** One field, compare-and-set against the version the caller read. The answer is the database's, then a fresh read. */
  async set(userId: string, token: string, body: unknown): Promise<InteractionPreferenceChangeView> {
    const value = record(body);
    exactKeys(value, ['field', 'value', 'expectedVersion']);
    const field = isPreferenceField(value.field) ? value.field : invalid();
    const chosen = isPreferenceValue(field, value.value) ? value.value : invalid();
    const expectedVersion = expectedVersionOf(value.expectedVersion);
    return this.guard(async () => {
      const outcome = outcomeOf(await this.repository.set(token, field, chosen, expectedVersion));
      if (outcome === 'NOT_ELIGIBLE') throw new Error('INTERACTION_PREFERENCE_OUTCOME_INTEGRITY');
      return { outcome, ...(await this.readRecord(token, userId)) };
    });
  }

  /** The owner's SELF legacy preference Memories that name an approved value the record does not already hold. */
  async legacyReview(userId: string, token: string): Promise<LegacyReviewView> {
    return this.guard(async () => {
      const current = await this.readRecord(token, userId);
      const seen = new Set<string>();
      const candidates: LegacyReviewCandidateView[] = [];
      for (const memory of eligibleLegacyMemories(await this.repository.legacyMemories(token, userId))) {
        const stated = interpretLegacyInteractionPreference(memory.content);
        if (!stated) continue;
        const held = current.preferences[PREFERENCE_KEY[stated.field]];
        const key = `${stated.field}:${stated.value}`;
        if (held === stated.value || seen.has(key)) continue;
        seen.add(key);
        candidates.push({ memoryId: memory.id, statement: memory.content, field: stated.field, value: stated.value, replacesCurrent: held !== 'DEFAULT' });
      }
      return { ...current, candidates };
    });
  }

  /**
   * Adopt what ONE legacy Memory states. The server re-reads that Memory and derives the value itself (the caller names
   * only the Memory and the version it read); the database re-validates the Memory at commit and never changes it.
   */
  async applyLegacy(userId: string, token: string, body: unknown): Promise<LegacyReviewApplyView> {
    const value = record(body);
    exactKeys(value, ['memoryId', 'expectedVersion']);
    const memoryId = typeof value.memoryId === 'string' && UUID.test(value.memoryId) ? value.memoryId : invalid();
    const expectedVersion = expectedVersionOf(value.expectedVersion);
    return this.guard(async () => {
      const [memory] = eligibleLegacyMemories(await this.repository.legacyMemories(token, userId, [memoryId]));
      const stated = memory ? interpretLegacyInteractionPreference(memory.content) : null;
      const outcome: LegacyReviewOutcome = stated === null ? 'NOT_ELIGIBLE'
        : outcomeOf(await this.repository.applyLegacy(token, memoryId, stated.field, stated.value, expectedVersion));
      return { outcome, ...(await this.readRecord(token, userId)) };
    });
  }

  // ------------------------------------------------------------------------------------------------------------------

  private async readRecord(accessToken: string, userId: string): Promise<InteractionPreferenceRecord> {
    const rows = await this.repository.read(accessToken, userId);
    if (!Array.isArray(rows) || rows.length > 1) throw new Error('INTERACTION_PREFERENCES_INTEGRITY');
    if (rows.length === 0) return { preferences: DEFAULT_INTERACTION_PREFERENCES, version: 0 };
    const row = record(rows[0]);
    const version = row.version;
    if (!isPreferenceValue('REPLY_LENGTH', row.reply_length) || !isPreferenceValue('REPLY_LANGUAGE', row.reply_language)
      || !isPreferenceValue('HUMOUR', row.humour) || !isPreferenceValue('EXPLANATION_STYLE', row.explanation_style)
      || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
      throw new Error('INTERACTION_PREFERENCES_INTEGRITY');
    }
    return {
      preferences: Object.freeze({
        replyLength: row.reply_length, replyLanguage: row.reply_language, humour: row.humour, explanationStyle: row.explanation_style,
      }) as InteractionPreferences,
      version,
    };
  }

  // A refusal the caller may see stays as it is (400). Everything else - an upstream failure, a malformed answer -
  // fails closed as one sanitized 503 that names nothing internal.
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    }
  }
}

function outcomeOf(rows: unknown): LegacyReviewOutcome {
  const outcome = Array.isArray(rows) && rows.length === 1 ? record(rows[0]).outcome : undefined;
  if (outcome === 'NOT_ELIGIBLE' || (typeof outcome === 'string' && INTERACTION_PREFERENCE_OUTCOMES.has(outcome))) return outcome as LegacyReviewOutcome;
  throw new Error('INTERACTION_PREFERENCE_OUTCOME_INTEGRITY');
}

/** Only the owner's own ACTIVE, unexpired INTERACTION_PREFERENCE Memories attributed SELF: never OTHER or UNATTRIBUTED. */
function eligibleLegacyMemories(rows: unknown): Array<{ id: string; content: string }> {
  if (!Array.isArray(rows)) throw new Error('INTERACTION_PREFERENCE_LEGACY_INTEGRITY');
  const now = Date.now();
  return rows.map(record).filter((row) =>
    typeof row.id === 'string' && UUID.test(row.id) && typeof row.content === 'string'
    && row.status === 'ACTIVE' && row.type === 'INTERACTION_PREFERENCE'
    && (row.expires_at === null || row.expires_at === undefined || (typeof row.expires_at === 'string' && Date.parse(row.expires_at) > now))
    && readMemorySubject(row.memory_subject_attributions) === 'SELF',
  ).map((row) => ({ id: row.id as string, content: row.content as string }));
}
