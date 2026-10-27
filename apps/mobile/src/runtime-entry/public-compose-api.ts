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
 * S8A-05 CP2 — «انشر من قنديل» / Publish from QANDEEL: the draft's material is the reader's own conversation or one
 * «فهم قنديل» item, chosen by REFERENCE only — Session Positions or an opaque item ref — never a copied text:
 *
 *   GET  /public/compose/drafts/:id/source               the source as the reader chose it
 *   PUT  /public/compose/drafts/:id/source/conversation  { expectedRevision, sessionId, firstPosition, lastPosition,
 *                                                        includeQandeelReplies, excludedMessagePositions, emphasizedMessagePositions }
 *   POST /public/compose/drafts/:id/source/clear         { expectedRevision }
 *   POST /public/compose/drafts/:id/source/acknowledge   { revision } — the one acknowledgement QANDEEL material needs
 *   GET  /public/compose/drafts/:id/items?page=N         one page of 50 of exactly what the topic would contain
 *   POST /understanding/items/:ref/public-topic          { draftId, expectedRevision, revision } — a «فهم قنديل» item
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
/** S8A-05 CP2 (0180): a source's own refusals — closed — and the one acknowledgement QANDEEL material needs. */
export const PUBLIC_TOPIC_SOURCE_REFUSALS = ['SOURCE_UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'SELECTION_INVALID', 'NOTHING_SELECTED', 'TOO_LARGE',
  'UNDERSTANDING_CHANGED', 'UNDERSTANDING_UNDER_REVIEW', 'UNDERSTANDING_WITHHELD'] as const;
export type PublicTopicSourceRefusal = typeof PUBLIC_TOPIC_SOURCE_REFUSALS[number];
export type PublicTopicReadiness = 'READY' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'ACKNOWLEDGEMENT_REQUIRED' | PublicTopicSourceRefusal;
/** One page holds at most 50 items; every item is reachable page by page. */
export const PUBLIC_TOPIC_ITEMS_PAGE_SIZE = 50;
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
  | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED' | 'SECTION_REQUIRED' | 'NOT_PREPARED' | 'ACKNOWLEDGEMENT_REQUIRED' | PublicTopicSourceRefusal;
export type PublicTopicDiscardOutcome = 'DISCARDED' | 'ALREADY_DISCARDED' | 'NOT_DISCARDABLE' | 'UNAVAILABLE';
export type PublicTopicSectionOutcome = 'CHANGED' | 'UNCHANGED' | 'UNAVAILABLE' | 'INVALID';

/** S8A-05 CP2 — the draft's source and its items. */
export type PublicTopicSource =
  | { readonly kind: 'NONE' }
  | {
    readonly kind: 'CONVERSATION'; readonly sessionId: string; readonly firstPosition: number; readonly lastPosition: number;
    readonly includeQandeelReplies: boolean; readonly excludedMessagePositions: ReadonlyArray<number>; readonly emphasizedMessagePositions: ReadonlyArray<number>;
  }
  | { readonly kind: 'UNDERSTANDING'; readonly ref: string; readonly revision: string };
export interface PublicTopicConversationChoice {
  readonly sessionId: string; readonly firstPosition: number; readonly lastPosition: number; readonly includeQandeelReplies: boolean;
  readonly excludedMessagePositions: ReadonlyArray<number>; readonly emphasizedMessagePositions: ReadonlyArray<number>;
}
export type PublicTopicSourceRead =
  | { readonly kind: 'SOURCE'; readonly revision: number; readonly source: PublicTopicSource; readonly acknowledged: boolean }
  | { readonly kind: 'ABSENT' };
export type PublicTopicSourceOutcome = PublicTopicSaveOutcome | PublicTopicSourceRefusal;
export interface PublicTopicSourceResult { readonly outcome: PublicTopicSourceOutcome; readonly revision: number | null }
export type PublicTopicClearOutcome = 'SAVED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'ACCOUNT_DELETION_PENDING';
export type PublicTopicAcknowledgeOutcome = 'ACKNOWLEDGED' | 'STALE' | 'NOT_FOUND' | 'PREPARED' | 'NO_SOURCE' | 'ACCOUNT_DELETION_PENDING';
export type PublicTopicItemRole = 'WRITTEN' | 'YOUR_MESSAGE' | 'QANDEEL_REPLY' | 'QANDEEL_UNDERSTANDING';
export interface PublicTopicItem {
  readonly position: number; readonly role: PublicTopicItemRole; readonly message: number | null;
  readonly emphasized: boolean; readonly gapBefore: boolean; readonly text: string;
  /** The author's own view only: where the unit stands in their conversation (a reader is never told). */
  readonly sessionPosition: number | null;
}
export interface PublicTopicItemsPage {
  readonly state: PublicTopicDraftState; readonly revision: number; readonly outcome: 'RESOLVED' | 'PREPARED' | 'NO_SOURCE' | PublicTopicSourceRefusal;
  readonly itemCount: number; readonly page: number; readonly pageCount: number; readonly items: ReadonlyArray<PublicTopicItem>;
}
export type PublicTopicItemsRead = { readonly kind: 'PAGE'; readonly page: PublicTopicItemsPage } | { readonly kind: 'ABSENT' };
/** Choosing a «فهم قنديل» item: CHANGED when the reader's card is no longer the item's current version (409). */
export type PublicTopicUnderstandingOutcome = PublicTopicSourceOutcome | 'CHANGED' | 'ABSENT';

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
const READINESS: readonly string[] = ['READY', 'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'ACKNOWLEDGEMENT_REQUIRED', ...PUBLIC_TOPIC_SOURCE_REFUSALS];
const SAVE_OUTCOMES = ['CREATED', 'SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING'] as const;
const SOURCE_OUTCOMES = [...SAVE_OUTCOMES, ...PUBLIC_TOPIC_SOURCE_REFUSALS] as const;
const ROLES: readonly string[] = ['WRITTEN', 'YOUR_MESSAGE', 'QANDEEL_REPLY', 'QANDEEL_UNDERSTANDING'];
const ITEMS_OUTCOMES: readonly string[] = ['RESOLVED', 'PREPARED', 'NO_SOURCE', ...PUBLIC_TOPIC_SOURCE_REFUSALS];
const isPosition = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isPositions = (value: unknown): value is number[] => Array.isArray(value) && value.every(isPosition);
const OPAQUE = /^[A-Za-z0-9_-]{22}$/u;
/** One page of an author's items, strictly: the closed roles, ascending positions, never more than a page. */
export function publicTopicItemsOf(value: unknown, keys: readonly string[]): PublicTopicItem[] | null {
  if (!Array.isArray(value) || value.length > PUBLIC_TOPIC_ITEMS_PAGE_SIZE) return null;
  const items: PublicTopicItem[] = [];
  let previous = 0;
  for (const item of value as unknown[]) {
    if (!isRecord(item) || !hasExactly(item, keys) || !isPosition(item.position) || item.position <= previous || typeof item.role !== 'string'
      || !ROLES.includes(item.role) || (item.message !== null && !isPosition(item.message)) || typeof item.emphasized !== 'boolean'
      || typeof item.gapBefore !== 'boolean' || typeof item.text !== 'string'
      || ('sessionPosition' in item && item.sessionPosition !== null && !isPosition(item.sessionPosition))) return null;
    previous = item.position;
    items.push({ position: item.position, role: item.role as PublicTopicItemRole, message: item.message as number | null, emphasized: item.emphasized,
      gapBefore: item.gapBefore, text: item.text, sessionPosition: (item.sessionPosition as number | null | undefined) ?? null });
  }
  return items;
}
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
      'TITLE_TOO_SHORT', 'TEXT_REQUIRED', 'SECTION_REQUIRED', 'NOT_PREPARED', 'ACKNOWLEDGEMENT_REQUIRED', ...PUBLIC_TOPIC_SOURCE_REFUSALS] as const,
      ['outcome', 'experienceId']);
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

  /** S8A-05 CP2 — the draft takes its material from the reader's own conversation: positions only. */
  async setConversationSource(draftId: string, expectedRevision: number, choice: PublicTopicConversationChoice): Promise<PublicAuthoringAnswer<PublicTopicSourceResult>> {
    const answer = await this.exchange('PUT', `/public/compose/drafts/${encodeURIComponent(draftId)}/source/conversation`, {
      expectedRevision, sessionId: choice.sessionId, firstPosition: choice.firstPosition, lastPosition: choice.lastPosition,
      includeQandeelReplies: choice.includeQandeelReplies, excludedMessagePositions: [...choice.excludedMessagePositions],
      emphasizedMessagePositions: [...choice.emphasizedMessagePositions],
    });
    const decided = outcomeOf(answer, SOURCE_OUTCOMES, ['outcome', 'revision']);
    if (!decided || (decided.body.revision !== null && !isRevision(decided.body.revision))) return NO;
    return yes({ outcome: decided.outcome, revision: decided.body.revision as number | null });
  }

  /** A «فهم قنديل» item, at the revision on the reader's card, as the draft's material. */
  async setUnderstandingSource(ref: string, revision: string, draftId: string, expectedRevision: number):
  Promise<PublicAuthoringAnswer<{ readonly outcome: PublicTopicUnderstandingOutcome; readonly revision: number | null }>> {
    const answer = await this.exchange('POST', `/understanding/items/${encodeURIComponent(ref)}/public-topic`, { draftId, expectedRevision, revision });
    if (answer.kind === 'STATUS' && answer.status === 409) return yes({ outcome: 'CHANGED', revision: null });
    if (answer.kind === 'STATUS' && answer.status === 404) return yes({ outcome: 'ABSENT', revision: null });
    const decided = outcomeOf(answer, SOURCE_OUTCOMES, ['outcome', 'draftRevision']);
    if (!decided || (decided.body.draftRevision !== null && !isRevision(decided.body.draftRevision))) return NO;
    return yes({ outcome: decided.outcome, revision: decided.body.draftRevision as number | null });
  }

  async clearSource(draftId: string, expectedRevision: number): Promise<PublicAuthoringAnswer<{ readonly outcome: PublicTopicClearOutcome; readonly revision: number | null }>> {
    const answer = await this.exchange('POST', `/public/compose/drafts/${encodeURIComponent(draftId)}/source/clear`, { expectedRevision });
    const decided = outcomeOf(answer, ['SAVED', 'STALE', 'NOT_FOUND', 'PREPARED', 'ACCOUNT_DELETION_PENDING'] as const, ['outcome', 'revision']);
    if (!decided || (decided.body.revision !== null && !isRevision(decided.body.revision))) return NO;
    return yes({ outcome: decided.outcome, revision: decided.body.revision as number | null });
  }

  async acknowledgeSource(draftId: string, revision: number): Promise<PublicAuthoringAnswer<PublicTopicAcknowledgeOutcome>> {
    const answer = await this.exchange('POST', `/public/compose/drafts/${encodeURIComponent(draftId)}/source/acknowledge`, { revision });
    const decided = outcomeOf(answer, ['ACKNOWLEDGED', 'STALE', 'NOT_FOUND', 'PREPARED', 'NO_SOURCE', 'ACCOUNT_DELETION_PENDING'] as const, ['outcome', 'revision']);
    if (!decided || (decided.body.revision !== null && !isRevision(decided.body.revision))) return NO;
    return yes(decided.outcome);
  }

  async source(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicSourceRead>> {
    const answer = await this.exchange('GET', `/public/compose/drafts/${encodeURIComponent(draftId)}/source`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if (b.state === 'UNAVAILABLE' && hasExactly(b, ['state'])) return yes({ kind: 'ABSENT' });
    if (b.state !== 'CURRENT' || !hasExactly(b, ['state', 'revision', 'source', 'acknowledged']) || !isRevision(b.revision)
      || typeof b.acknowledged !== 'boolean' || !isRecord(b.source)) return NO;
    const s = b.source;
    let source: PublicTopicSource;
    if (s.kind === 'NONE' && hasExactly(s, ['kind'])) {
      source = { kind: 'NONE' };
    } else if (s.kind === 'CONVERSATION' && hasExactly(s, ['kind', 'sessionId', 'firstPosition', 'lastPosition', 'includeQandeelReplies',
      'excludedMessagePositions', 'emphasizedMessagePositions']) && isUuid(s.sessionId) && isPosition(s.firstPosition) && isPosition(s.lastPosition)
      && typeof s.includeQandeelReplies === 'boolean' && isPositions(s.excludedMessagePositions) && isPositions(s.emphasizedMessagePositions)) {
      source = { kind: 'CONVERSATION', sessionId: s.sessionId, firstPosition: s.firstPosition, lastPosition: s.lastPosition,
        includeQandeelReplies: s.includeQandeelReplies, excludedMessagePositions: [...s.excludedMessagePositions], emphasizedMessagePositions: [...s.emphasizedMessagePositions] };
    } else if (s.kind === 'UNDERSTANDING' && hasExactly(s, ['kind', 'ref', 'revision']) && typeof s.ref === 'string' && OPAQUE.test(s.ref)
      && typeof s.revision === 'string' && OPAQUE.test(s.revision)) {
      source = { kind: 'UNDERSTANDING', ref: s.ref, revision: s.revision };
    } else {
      return NO;
    }
    return yes({ kind: 'SOURCE', revision: b.revision, source, acknowledged: b.acknowledged });
  }

  async items(draftId: string, page: number): Promise<PublicAuthoringAnswer<PublicTopicItemsRead>> {
    if (!isPosition(page) || page > 1000) return NO;
    const answer = await this.exchange('GET', `/public/compose/drafts/${encodeURIComponent(draftId)}/items?page=${page}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if (b.state === 'UNAVAILABLE' && hasExactly(b, ['state'])) return yes({ kind: 'ABSENT' });
    if (!hasExactly(b, ['state', 'revision', 'outcome', 'itemCount', 'page', 'pageCount', 'items']) || !isState(b.state) || !isRevision(b.revision)
      || typeof b.outcome !== 'string' || !ITEMS_OUTCOMES.includes(b.outcome) || !isCount(b.itemCount) || b.page !== page || !isCount(b.pageCount)) return NO;
    const items = publicTopicItemsOf(b.items, ['position', 'role', 'sessionPosition', 'message', 'emphasized', 'gapBefore', 'text']);
    if (items === null) return NO;
    return yes({ kind: 'PAGE', page: { state: b.state, revision: b.revision, outcome: b.outcome as PublicTopicItemsPage['outcome'], itemCount: b.itemCount,
      page, pageCount: b.pageCount, items } });
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
