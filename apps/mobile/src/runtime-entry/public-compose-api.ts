/**
 * S8A-05 CP1 — the client for «اكتب موضوعك» / Write your topic inside «العالم العام» / Public World.
 *
 *   GET  /public/compose/drafts                          the reader's own private topic drafts
 *   GET  /public/compose/drafts/:id                      one own draft, whole
 *   PUT  /public/compose/drafts/:id                      { expectedRevision, title, text, section } → create (revision 0) or save
 *   POST /public/compose/drafts/:id/delete               { commandId } → delete it; its words are gone
 *   GET  /public/compose/drafts/:id/preview              exactly what Public World would show, and the privacy notes
 *   POST /public/compose/drafts/:id/prepare              { commandId, expectedRevision } → closed until Stage 9
 *   POST /public/compose/topics/:experienceId/discard    { commandId } → back to the draft; the prepared copy is erased
 *   POST /public/compose/topics/:experienceId/section    { commandId, section } → never moves the topic's place
 *
 * A transport and nothing else, beside the other Public clients on the same identity-bound transport: no credential of
 * its own, no user id, no Public ref, no label, no approver, no retry. The only words it sends are the reader's own draft,
 * to their own draft. Every answer is decoded strictly; anything else is no answer. Nothing here can publish.
 */
import type { PublicAuthoringAnswer, PublicAuthoringApiConfig } from './public-authoring-api';
import { isPublicTopicSection, type PublicTopicSection } from './public-field-api';

/** The database bounds (0179): a title of 8–100 characters to prepare, a text of up to 5,000. */
export const PUBLIC_TOPIC_TITLE_MIN = 8;
export const PUBLIC_TOPIC_TITLE_MAX = 100;
export const PUBLIC_TOPIC_TEXT_MAX = 5000;

export type PublicTopicDraftState = 'EDITING' | 'PREPARED';
export type PublicTopicReadiness = 'READY' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED';
export type PublicTopicPrivacyNote = 'CONTACT_NUMBER' | 'EMAIL_ADDRESS' | 'LINK' | 'OWN_NAME' | 'SHOWN_UNDER_REAL_NAME';
export interface PublicTopicDraftSummary {
  readonly draftId: string; readonly revision: number; readonly title: string; readonly section: PublicTopicSection | null;
  readonly textLength: number; readonly state: PublicTopicDraftState; readonly experienceId: string | null; readonly updatedAt: string;
}
export interface PublicTopicDraft {
  readonly draftId: string; readonly revision: number; readonly title: string; readonly text: string; readonly section: PublicTopicSection | null;
  readonly state: PublicTopicDraftState; readonly experienceId: string | null;
}
export type PublicTopicDraftRead = { readonly kind: 'DRAFT'; readonly draft: PublicTopicDraft } | { readonly kind: 'ABSENT' };
export type PublicTopicSaveOutcome = 'CREATED' | 'SAVED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'LIMIT_REACHED' | 'INVALID' | 'ACCOUNT_DELETION_PENDING';
export interface PublicTopicSaveResult { readonly outcome: PublicTopicSaveOutcome; readonly revision: number | null }
export type PublicTopicDeleteOutcome = 'DELETED' | 'NOT_FOUND' | 'NOT_DISCARDABLE' | 'UNAVAILABLE' | 'ACCOUNT_DELETION_PENDING';
export interface PublicTopicPreview {
  readonly revision: number; readonly readiness: PublicTopicReadiness; readonly title: string; readonly text: string;
  readonly section: PublicTopicSection | null; readonly publisher: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
  readonly privacyNotes: ReadonlyArray<PublicTopicPrivacyNote>;
}
export type PublicTopicPreviewRead = { readonly kind: 'PREVIEW'; readonly preview: PublicTopicPreview } | { readonly kind: 'ABSENT' };
export type PublicTopicPrepareOutcome = 'PREPARED' | 'ALREADY_PREPARED' | 'PUBLICATION_NOT_OPEN' | 'ACCOUNT_DELETION_PENDING' | 'NOT_FOUND' | 'STALE'
  | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'NOT_PREPARED';
export type PublicTopicDiscardOutcome = 'DISCARDED' | 'ALREADY_DISCARDED' | 'NOT_DISCARDABLE' | 'UNAVAILABLE';
export type PublicTopicSectionOutcome = 'CHANGED' | 'UNCHANGED' | 'UNAVAILABLE' | 'INVALID';

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isRevision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const sectionOf = (value: unknown): PublicTopicSection | null | undefined => (value === null ? null : isPublicTopicSection(value) ? value : undefined);
const isState = (value: unknown): value is PublicTopicDraftState => value === 'EDITING' || value === 'PREPARED';
const NOTES: readonly string[] = ['CONTACT_NUMBER', 'EMAIL_ADDRESS', 'LINK', 'OWN_NAME', 'SHOWN_UNDER_REAL_NAME'];
const READINESS: readonly string[] = ['READY', 'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED'];
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

function outcomeOf<T extends string>(answer: Exchange, allowed: readonly T[], keys: readonly string[] = ['outcome']): { readonly outcome: T; readonly body: Record<string, unknown> } | null {
  if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, keys)) return null;
  const outcome = answer.body.outcome;
  return typeof outcome === 'string' && (allowed as readonly string[]).includes(outcome) ? { outcome: outcome as T, body: answer.body } : null;
}

export class PublicComposeApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async drafts(): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicTopicDraftSummary>>> {
    const answer = await this.exchange('GET', '/public/compose/drafts');
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['drafts']) || !Array.isArray(answer.body.drafts)) return NO;
    const drafts: PublicTopicDraftSummary[] = [];
    for (const d of answer.body.drafts as unknown[]) {
      if (!isRecord(d) || !hasExactly(d, ['draftId', 'revision', 'title', 'section', 'textLength', 'state', 'experienceId', 'updatedAt'])) return NO;
      const section = sectionOf(d.section);
      if (!isUuid(d.draftId) || !isRevision(d.revision) || typeof d.title !== 'string' || section === undefined || !isCount(d.textLength)
        || !isState(d.state) || (d.experienceId !== null && !isUuid(d.experienceId)) || typeof d.updatedAt !== 'string') return NO;
      drafts.push({ draftId: d.draftId, revision: d.revision, title: d.title, section, textLength: d.textLength, state: d.state,
        experienceId: d.experienceId as string | null, updatedAt: d.updatedAt });
    }
    return yes(drafts);
  }

  async draft(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicDraftRead>> {
    const answer = await this.exchange('GET', `/public/compose/drafts/${encodeURIComponent(draftId)}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const d = answer.body;
    if (d.state === 'UNAVAILABLE' && hasExactly(d, ['state'])) return yes({ kind: 'ABSENT' });
    if (!hasExactly(d, ['state', 'draftId', 'revision', 'title', 'text', 'section', 'experienceId', 'createdAt', 'updatedAt'])) return NO;
    const section = sectionOf(d.section);
    if (!isState(d.state) || d.draftId !== draftId || !isRevision(d.revision) || typeof d.title !== 'string' || typeof d.text !== 'string'
      || section === undefined || (d.experienceId !== null && !isUuid(d.experienceId))) return NO;
    return yes({ kind: 'DRAFT', draft: { draftId, revision: d.revision, title: d.title, text: d.text, section, state: d.state,
      experienceId: d.experienceId as string | null } });
  }

  async save(draftId: string, expectedRevision: number, title: string, text: string, section: PublicTopicSection | null): Promise<PublicAuthoringAnswer<PublicTopicSaveResult>> {
    const answer = await this.exchange('PUT', `/public/compose/drafts/${encodeURIComponent(draftId)}`, { expectedRevision, title, text, section });
    const decided = outcomeOf(answer, ['CREATED', 'SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING'] as const,
      ['outcome', 'revision']);
    if (!decided || (decided.body.revision !== null && !isRevision(decided.body.revision))) return NO;
    return yes({ outcome: decided.outcome, revision: decided.body.revision as number | null });
  }

  async remove(draftId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicTopicDeleteOutcome>> {
    const answer = await this.exchange('POST', `/public/compose/drafts/${encodeURIComponent(draftId)}/delete`, { commandId });
    const decided = outcomeOf(answer, ['DELETED', 'NOT_FOUND', 'NOT_DISCARDABLE', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING'] as const);
    return decided ? yes(decided.outcome) : NO;
  }

  async preview(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicPreviewRead>> {
    const answer = await this.exchange('GET', `/public/compose/drafts/${encodeURIComponent(draftId)}/preview`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const p = answer.body;
    if (p.state === 'UNAVAILABLE' && hasExactly(p, ['state'])) return yes({ kind: 'ABSENT' });
    if (p.state !== 'CURRENT' || !hasExactly(p, ['state', 'revision', 'readiness', 'title', 'text', 'section', 'publisher', 'privacyNotes'])) return NO;
    const section = sectionOf(p.section);
    const publisher = isRecord(p.publisher) && hasExactly(p.publisher, ['mode', 'label']) && (p.publisher.mode === 'PSEUDONYM' || p.publisher.mode === 'REAL_NAME')
      && (p.publisher.label === null || typeof p.publisher.label === 'string') ? p.publisher : null;
    if (!isRevision(p.revision) || typeof p.readiness !== 'string' || !READINESS.includes(p.readiness) || typeof p.title !== 'string' || typeof p.text !== 'string'
      || section === undefined || publisher === null || !Array.isArray(p.privacyNotes)
      || !p.privacyNotes.every((note) => typeof note === 'string' && NOTES.includes(note))) return NO;
    return yes({ kind: 'PREVIEW', preview: { revision: p.revision, readiness: p.readiness as PublicTopicReadiness, title: p.title, text: p.text, section,
      publisher: { mode: publisher.mode as 'PSEUDONYM' | 'REAL_NAME', label: publisher.label as string | null },
      privacyNotes: [...p.privacyNotes] as PublicTopicPrivacyNote[] } });
  }

  async prepare(draftId: string, commandId: string, expectedRevision: number): Promise<PublicAuthoringAnswer<PublicTopicPrepareOutcome>> {
    const answer = await this.exchange('POST', `/public/compose/drafts/${encodeURIComponent(draftId)}/prepare`, { commandId, expectedRevision });
    const decided = outcomeOf(answer, ['PREPARED', 'ALREADY_PREPARED', 'PUBLICATION_NOT_OPEN', 'ACCOUNT_DELETION_PENDING', 'NOT_FOUND', 'STALE',
      'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'NOT_PREPARED'] as const, ['outcome', 'experienceId']);
    if (!decided || (decided.body.experienceId !== null && !isUuid(decided.body.experienceId))) return NO;
    return yes(decided.outcome);
  }

  async discard(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicTopicDiscardOutcome>> {
    const answer = await this.exchange('POST', `/public/compose/topics/${encodeURIComponent(experienceId)}/discard`, { commandId });
    const decided = outcomeOf(answer, ['DISCARDED', 'ALREADY_DISCARDED', 'NOT_DISCARDABLE', 'UNAVAILABLE'] as const);
    return decided ? yes(decided.outcome) : NO;
  }

  async section(experienceId: string, commandId: string, section: PublicTopicSection): Promise<PublicAuthoringAnswer<PublicTopicSectionOutcome>> {
    const answer = await this.exchange('POST', `/public/compose/topics/${encodeURIComponent(experienceId)}/section`, { commandId, section });
    const decided = outcomeOf(answer, ['CHANGED', 'UNCHANGED', 'UNAVAILABLE', 'INVALID'] as const, ['outcome', 'sectionRevision']);
    return decided ? yes(decided.outcome) : NO;
  }

  private async exchange(method: 'GET' | 'PUT' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
