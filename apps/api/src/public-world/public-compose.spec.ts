import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import type { PublicComposeRepository } from './public-compose.repository';
import { understandingItemRef, understandingRevision } from '../understanding/understanding-projection';
import { PublicComposeService, TOPIC_SECTIONS } from './public-compose.service';
import type { PublicFieldRepository } from './public-field.repository';
import { PublicFieldService } from './public-field.service';

const TOKEN = 'author-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const DRAFT = id(1);
const COMMAND = id(2);
const EXPERIENCE = id(3);
const TITLE = 'كيف أبدأ من جديد بعد الانتقال';
const TEXT = 'انتقلت إلى مدينة جديدة ولا أعرف أحدًا.\nأريد أن أسمع من مرّ بهذا.';

const SESSION = id(4);
const USER = id(7);
const ITEM = (position: number, role: string, sp: number, emphasized: boolean, gapBefore = false) => ({
  position, role, sessionPosition: sp, message: position, emphasized, gapBefore, text: `message ${position}`,
});

const ROW = {
  draft_id: DRAFT, draft_revision: 2, title: TITLE, body: TEXT, section_key: 'life_changes', draft_state: 'EDITING',
  experience_id: null, experience_lifecycle: null, created_at: '2026-10-26T10:00:00Z', updated_at: '2026-10-26T10:05:00Z',
};
function repository(overrides: Partial<Record<keyof PublicComposeRepository, jest.Mock>> = {}) {
  return {
    drafts: jest.fn(async () => [{ draft_id: DRAFT, draft_revision: 2, title: TITLE, section_key: 'life_changes', text_length: TEXT.length,
      draft_state: 'EDITING', experience_id: null, experience_lifecycle: null, updated_at: '2026-10-26T10:05:00Z' }]),
    draft: jest.fn(async () => [ROW]),
    save: jest.fn(async () => [{ outcome: 'SAVED', draft_revision: 3 }]),
    remove: jest.fn(async () => [{ outcome: 'DELETED' }]),
    preview: jest.fn(async () => [{ draft_revision: 2, readiness: 'READY', title: TITLE, body: TEXT, section_key: 'life_changes',
      publisher_label_mode: 'PSEUDONYM', publisher_display_label: 'سائر', privacy_notes: [] }]),
    // Production: the launch seam is NOT_EVALUATED, so preparing writes nothing.
    prepare: jest.fn(async () => [{ outcome: 'PUBLICATION_NOT_OPEN', experience_id: null, current_lifecycle: null }]),
    discard: jest.fn(async () => [{ outcome: 'DISCARDED' }]),
    section: jest.fn(async () => [{ outcome: 'CHANGED', section_revision: 2 }]),
    // S8A-05 CP2 (0180).
    setConversationSource: jest.fn(async () => [{ outcome: 'SAVED', draft_revision: 3 }]),
    clearSource: jest.fn(async () => [{ outcome: 'SAVED', draft_revision: 4 }]),
    acknowledgeSource: jest.fn(async () => [{ outcome: 'ACKNOWLEDGED', draft_revision: 3 }]),
    source: jest.fn(async () => [{ draft_revision: 3, source_kind: 'CONVERSATION', session_id: SESSION, first_sp: 1, last_sp: 8, include_qandeel: true,
      excluded_sps: [3], emphasized_sps: [5], hypothesis_id: null, hypothesis_version: null, acknowledged: false }]),
    items: jest.fn(async () => [{ draft_revision: 3, draft_state: 'EDITING', outcome: 'RESOLVED', item_count: 2, text_bytes: 40, page: 1, page_count: 1,
      items: [ITEM(1, 'YOUR_MESSAGE', 1, false), ITEM(2, 'QANDEEL_REPLY', 2, true)] }]),
    ...overrides,
  };
}
const service = (repo = repository()) => new PublicComposeService(repo as unknown as PublicComposeRepository);

describe('S8A-05 CP1 — the private, account-bound topic draft', () => {
  it('lists and reads only what the database answers for this token, and one neutral absence otherwise', async () => {
    await expect(service().drafts(TOKEN)).resolves.toEqual({ drafts: [{ draftId: DRAFT, revision: 2, title: TITLE, section: 'life_changes',
      textLength: TEXT.length, state: 'EDITING', experienceId: null, updatedAt: '2026-10-26T10:05:00Z' }] });
    await expect(service().draft(TOKEN, DRAFT)).resolves.toEqual({ state: 'EDITING', draftId: DRAFT, revision: 2, title: TITLE, text: TEXT,
      section: 'life_changes', experienceId: null, createdAt: '2026-10-26T10:00:00Z', updatedAt: '2026-10-26T10:05:00Z' });
    // Another human's draft: the database answers no row; the API never says why.
    await expect(service(repository({ draft: jest.fn(async () => []) })).draft(TOKEN, DRAFT)).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(service().draft(TOKEN, 'guess')).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(service(repository({ draft: jest.fn(async () => [{ ...ROW, section_key: 'politics' }]) })).draft(TOKEN, DRAFT))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates at revision 0 and saves by compare-and-set; the author\'s own words go to their own draft only', async () => {
    const repo = repository({ save: jest.fn(async () => [{ outcome: 'CREATED', draft_revision: 1 }]) });
    await expect(service(repo).save(TOKEN, DRAFT, { expectedRevision: 0, title: TITLE, text: TEXT, section: 'life_changes' }))
      .resolves.toEqual({ outcome: 'CREATED', revision: 1 });
    expect(repo.save).toHaveBeenCalledWith(TOKEN, DRAFT, 0, TITLE, TEXT, 'life_changes');
    // A title still being written may be short; only preparing demands 8 characters.
    await expect(service().save(TOKEN, DRAFT, { expectedRevision: 2, title: 'قصير', text: '', section: null })).resolves.toEqual({ outcome: 'SAVED', revision: 3 });
    for (const outcome of ['STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING']) {
      await expect(service(repository({ save: jest.fn(async () => [{ outcome, draft_revision: null }]) }))
        .save(TOKEN, DRAFT, { expectedRevision: 2, title: TITLE, text: TEXT })).resolves.toEqual({ outcome, revision: null });
    }
  });

  it('refuses a malformed save before the database: the bounds, the sections, no foreign key', () => {
    const ok = { expectedRevision: 1, title: TITLE, text: TEXT, section: 'love' };
    for (const body of [null, [], {}, { ...ok, expectedRevision: -1 }, { ...ok, expectedRevision: 1.5 }, { ...ok, title: 'x'.repeat(101) },
      { ...ok, text: 'x'.repeat(5001) }, { ...ok, section: 'politics' }, { ...ok, userId: id(9) }, { ...ok, publicRef: 'x' }, { ...ok, title: 5 }]) {
      expect(() => service().save(TOKEN, DRAFT, body)).toThrow(BadRequestException);
    }
    expect(() => service().save(TOKEN, 'guess', ok)).toThrow(BadRequestException);
    expect(TOPIC_SECTIONS).toHaveLength(13);
    expect(TOPIC_SECTIONS[12]).toBe('open');
  });

  it('deletes by command id; a prepared, never-published topic is discarded with it', async () => {
    const repo = repository();
    await expect(service(repo).remove(TOKEN, DRAFT, { commandId: COMMAND })).resolves.toEqual({ outcome: 'DELETED' });
    expect(repo.remove).toHaveBeenCalledWith(TOKEN, COMMAND, DRAFT);
    await expect(service(repository({ remove: jest.fn(async () => [{ outcome: 'NOT_DISCARDABLE' }]) })).remove(TOKEN, DRAFT, { commandId: COMMAND }))
      .resolves.toEqual({ outcome: 'NOT_DISCARDABLE' });
    expect(() => service().remove(TOKEN, DRAFT, {})).toThrow(BadRequestException);
    expect(() => service().remove(TOKEN, DRAFT, { commandId: COMMAND, force: true })).toThrow(BadRequestException);
  });
});

describe('S8A-05 CP1 — preview, preparation and return to the draft', () => {
  it('previews exactly what the Public World would show, with the current display and the privacy notes', async () => {
    await expect(service().preview(TOKEN, DRAFT)).resolves.toEqual({ state: 'CURRENT', revision: 2, readiness: 'READY', title: TITLE, text: TEXT,
      section: 'life_changes', publisher: { mode: 'PSEUDONYM', label: 'سائر' }, privacyNotes: [] });
    const noted = repository({ preview: jest.fn(async () => [{ draft_revision: 1, readiness: 'TITLE_TOO_SHORT', title: 'قصير', body: 'اتصل 0123456789',
      section_key: null, publisher_label_mode: 'REAL_NAME', publisher_display_label: null, privacy_notes: ['CONTACT_NUMBER', 'SHOWN_UNDER_REAL_NAME'] }]) });
    await expect(service(noted).preview(TOKEN, DRAFT)).resolves.toMatchObject({ readiness: 'TITLE_TOO_SHORT', privacyNotes: ['CONTACT_NUMBER', 'SHOWN_UNDER_REAL_NAME'] });
    await expect(service(repository({ preview: jest.fn(async () => []) })).preview(TOKEN, DRAFT)).resolves.toEqual({ state: 'UNAVAILABLE' });
    const unknownNote = repository({ preview: jest.fn(async () => [{ draft_revision: 1, readiness: 'READY', title: TITLE, body: TEXT, section_key: 'love',
      publisher_label_mode: 'PSEUDONYM', publisher_display_label: 'x', privacy_notes: ['SOMETHING_ELSE'] }]) });
    await expect(service(unknownNote).preview(TOKEN, DRAFT)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers PUBLICATION_NOT_OPEN in production and passes every bounded outcome through unchanged', async () => {
    const repo = repository();
    await expect(service(repo).prepare(TOKEN, DRAFT, { commandId: COMMAND, expectedRevision: 2 })).resolves.toEqual({ outcome: 'PUBLICATION_NOT_OPEN', experienceId: null });
    expect(repo.prepare).toHaveBeenCalledWith(TOKEN, COMMAND, DRAFT, 2);
    const prepared = repository({ prepare: jest.fn(async () => [{ outcome: 'PREPARED', experience_id: EXPERIENCE, current_lifecycle: 'READY_FOR_REVIEW' }]) });
    await expect(service(prepared).prepare(TOKEN, DRAFT, { commandId: COMMAND, expectedRevision: 2 })).resolves.toEqual({ outcome: 'PREPARED', experienceId: EXPERIENCE });
    for (const body of [{ commandId: COMMAND }, { commandId: COMMAND, expectedRevision: 0 }, { commandId: 'x', expectedRevision: 1 },
      { commandId: COMMAND, expectedRevision: 1, clearance: 'CLEARED' }]) {
      expect(() => service().prepare(TOKEN, DRAFT, body)).toThrow(BadRequestException);
    }
    await expect(service(repository({ prepare: jest.fn(async () => [{ outcome: 'PUBLISHED', experience_id: null, current_lifecycle: null }]) }))
      .prepare(TOKEN, DRAFT, { commandId: COMMAND, expectedRevision: 2 })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('discards a never-published topic and changes a section by command id, never naming a place', async () => {
    const repo = repository();
    await expect(service(repo).discard(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'DISCARDED' });
    expect(repo.discard).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE);
    await expect(service(repo).section(TOKEN, EXPERIENCE, { commandId: COMMAND, section: 'open' })).resolves.toEqual({ outcome: 'CHANGED', sectionRevision: 2 });
    expect(repo.section).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE, 'open');
    expect(() => service().section(TOKEN, EXPERIENCE, { commandId: COMMAND, section: 'open', x: '1' })).toThrow(BadRequestException);
    expect(() => service().section(TOKEN, EXPERIENCE, { commandId: COMMAND, section: 'news' })).toThrow(BadRequestException);
    await expect(service().discard(TOKEN, 'guess', { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
  });

  it('turns a transport failure into 503, never into a decision', async () => {
    const failing = repository({ save: jest.fn(async () => { throw new Error('down'); }) });
    await expect(service(failing).save(TOKEN, DRAFT, { expectedRevision: 1, title: TITLE, text: TEXT, section: 'love' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S8A-05 CP2 — publish from QANDEEL: the source by reference, the acknowledgement and the paged items', () => {
  const CONVERSATION = { expectedRevision: 2, sessionId: SESSION, firstPosition: 1, lastPosition: 8, includeQandeelReplies: true,
    excludedMessagePositions: [3], emphasizedMessagePositions: [5] };

  it('sends positions only — never a text, a speaker or an order — and passes every bounded outcome through', async () => {
    const repo = repository();
    await expect(service(repo).setConversationSource(TOKEN, DRAFT, CONVERSATION)).resolves.toEqual({ outcome: 'SAVED', revision: 3 });
    expect(repo.setConversationSource).toHaveBeenCalledWith(TOKEN, DRAFT, 2,
      { sessionId: SESSION, firstSp: 1, lastSp: 8, includeQandeel: true, excludedSps: [3], emphasizedSps: [5] });
    // A new draft from a conversation is revision 0 under a fresh id; the lists may be left out.
    const { excludedMessagePositions: _e, emphasizedMessagePositions: _m, ...bare } = CONVERSATION;
    await service(repo).setConversationSource(TOKEN, DRAFT, { ...bare, expectedRevision: 0 });
    expect(repo.setConversationSource).toHaveBeenLastCalledWith(TOKEN, DRAFT, 0,
      { sessionId: SESSION, firstSp: 1, lastSp: 8, includeQandeel: true, excludedSps: [], emphasizedSps: [] });
    for (const outcome of ['CREATED', 'STALE', 'NOT_FOUND', 'PREPARED', 'LIMIT_REACHED', 'INVALID', 'ACCOUNT_DELETION_PENDING', 'SOURCE_UNAVAILABLE',
      'NOT_WHOLE_MESSAGES', 'SELECTION_INVALID', 'NOTHING_SELECTED', 'TOO_LARGE']) {
      await expect(service(repository({ setConversationSource: jest.fn(async () => [{ outcome, draft_revision: null }]) }))
        .setConversationSource(TOKEN, DRAFT, CONVERSATION)).resolves.toEqual({ outcome, revision: null });
    }
    await expect(service(repository({ setConversationSource: jest.fn(async () => [{ outcome: 'PUBLISHED', draft_revision: null }]) }))
      .setConversationSource(TOKEN, DRAFT, CONVERSATION)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses a malformed source before the database: no text, no speaker, no order, no foreign key, bounded lists', () => {
    for (const body of [{ ...CONVERSATION, text: 'x' }, { ...CONVERSATION, speaker: 'USER' }, { ...CONVERSATION, order: [1, 2] },
      { ...CONVERSATION, userId: id(9) }, { ...CONVERSATION, sessionId: 'guess' }, { ...CONVERSATION, firstPosition: 0 },
      { ...CONVERSATION, lastPosition: 0 }, { ...CONVERSATION, firstPosition: 5, lastPosition: 4 }, { ...CONVERSATION, includeQandeelReplies: 'yes' },
      { ...CONVERSATION, excludedMessagePositions: [0] }, { ...CONVERSATION, emphasizedMessagePositions: ['5'] },
      { ...CONVERSATION, emphasizedMessagePositions: Array.from({ length: 10001 }, (_, i) => i + 1) }, { ...CONVERSATION, expectedRevision: -1 }]) {
      expect(() => service().setConversationSource(TOKEN, DRAFT, body)).toThrow(BadRequestException);
    }
    expect(() => service().setConversationSource(TOKEN, 'guess', CONVERSATION)).toThrow(BadRequestException);
  });

  it('clears the source and records the ONE acknowledgement for the exact revision previewed', async () => {
    const repo = repository();
    await expect(service(repo).clearSource(TOKEN, DRAFT, { expectedRevision: 3 })).resolves.toEqual({ outcome: 'SAVED', revision: 4 });
    expect(repo.clearSource).toHaveBeenCalledWith(TOKEN, DRAFT, 3);
    await expect(service(repo).acknowledgeSource(TOKEN, DRAFT, { revision: 3 })).resolves.toEqual({ outcome: 'ACKNOWLEDGED', revision: 3 });
    expect(repo.acknowledgeSource).toHaveBeenCalledWith(TOKEN, DRAFT, 3);
    for (const outcome of ['STALE', 'NOT_FOUND', 'PREPARED', 'NO_SOURCE']) {
      await expect(service(repository({ acknowledgeSource: jest.fn(async () => [{ outcome, draft_revision: 3 }]) })).acknowledgeSource(TOKEN, DRAFT, { revision: 3 }))
        .resolves.toEqual({ outcome, revision: 3 });
    }
    expect(() => service().acknowledgeSource(TOKEN, DRAFT, { revision: 3, accepted: true })).toThrow(BadRequestException);
    expect(() => service().acknowledgeSource(TOKEN, DRAFT, {})).toThrow(BadRequestException);
    expect(() => service().clearSource(TOKEN, DRAFT, { expectedRevision: 0 })).toThrow(BadRequestException);
  });

  it('reads the source back as the author chose it; a «فهم قنديل» item only by its opaque ref and revision', async () => {
    await expect(service().source(TOKEN, USER, DRAFT)).resolves.toEqual({ state: 'CURRENT', revision: 3, acknowledged: false, source: {
      kind: 'CONVERSATION', sessionId: SESSION, firstPosition: 1, lastPosition: 8, includeQandeelReplies: true,
      excludedMessagePositions: [3], emphasizedMessagePositions: [5] } });
    const H = id(11);
    const understanding = repository({ source: jest.fn(async () => [{ draft_revision: 1, source_kind: 'UNDERSTANDING', session_id: null, first_sp: null,
      last_sp: null, include_qandeel: null, excluded_sps: null, emphasized_sps: null, hypothesis_id: H, hypothesis_version: 4, acknowledged: true }]) });
    const read = await service(understanding).source(TOKEN, USER, DRAFT);
    expect(read).toEqual({ state: 'CURRENT', revision: 1, acknowledged: true,
      source: { kind: 'UNDERSTANDING', ref: understandingItemRef(USER, H), revision: understandingRevision(USER, H, 4) } });
    expect(JSON.stringify(read)).not.toContain(H);
    const none = repository({ source: jest.fn(async () => [{ draft_revision: 1, source_kind: null, session_id: null, first_sp: null, last_sp: null,
      include_qandeel: null, excluded_sps: null, emphasized_sps: null, hypothesis_id: null, hypothesis_version: null, acknowledged: false }]) });
    await expect(service(none).source(TOKEN, USER, DRAFT)).resolves.toMatchObject({ source: { kind: 'NONE' } });
    await expect(service(repository({ source: jest.fn(async () => []) })).source(TOKEN, USER, DRAFT)).resolves.toEqual({ state: 'UNAVAILABLE' });
  });

  it('pages exactly what the topic would contain, with speakers, emphasis and gaps; a refusal carries no item', async () => {
    const repo = repository();
    await expect(service(repo).items(TOKEN, DRAFT, { page: '1' })).resolves.toEqual({ state: 'EDITING', revision: 3, outcome: 'RESOLVED', itemCount: 2,
      page: 1, pageCount: 1, items: [ITEM(1, 'YOUR_MESSAGE', 1, false), ITEM(2, 'QANDEEL_REPLY', 2, true)] });
    expect(repo.items).toHaveBeenCalledWith(TOKEN, DRAFT, 1);
    await service(repo).items(TOKEN, DRAFT, {});
    expect(repo.items).toHaveBeenLastCalledWith(TOKEN, DRAFT, 1);
    const refused = repository({ items: jest.fn(async () => [{ draft_revision: 3, draft_state: 'EDITING', outcome: 'NOT_WHOLE_MESSAGES', item_count: null,
      text_bytes: null, page: 1, page_count: 0, items: [] }]) });
    await expect(service(refused).items(TOKEN, DRAFT, {})).resolves.toMatchObject({ outcome: 'NOT_WHOLE_MESSAGES', itemCount: 0, items: [] });
    const leaking = repository({ items: jest.fn(async () => [{ draft_revision: 3, draft_state: 'EDITING', outcome: 'TOO_LARGE', item_count: 1,
      text_bytes: 1, page: 1, page_count: 0, items: [ITEM(1, 'YOUR_MESSAGE', 1, false)] }]) });
    await expect(service(leaking).items(TOKEN, DRAFT, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    const evidence = repository({ items: jest.fn(async () => [{ draft_revision: 3, draft_state: 'EDITING', outcome: 'RESOLVED', item_count: 1,
      text_bytes: 1, page: 1, page_count: 1, items: [{ ...ITEM(1, 'EVIDENCE', 1, false) }] }]) });
    await expect(service(evidence).items(TOKEN, DRAFT, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    const shuffled = repository({ items: jest.fn(async () => [{ draft_revision: 3, draft_state: 'EDITING', outcome: 'RESOLVED', item_count: 2,
      text_bytes: 1, page: 1, page_count: 1, items: [ITEM(2, 'YOUR_MESSAGE', 2, false), ITEM(1, 'YOUR_MESSAGE', 1, false)] }]) });
    await expect(service(shuffled).items(TOKEN, DRAFT, {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    for (const query of [{ page: '0' }, { page: '1001' }, { page: 'x' }, { page: '1', size: '500' }]) {
      expect(() => service().items(TOKEN, DRAFT, query)).toThrow(BadRequestException);
    }
  });

  it('previews and prepares a sourced draft with its own refusals and the acknowledgement it needs', async () => {
    const pending = repository({ preview: jest.fn(async () => [{ draft_revision: 3, readiness: 'ACKNOWLEDGEMENT_REQUIRED', title: TITLE, body: '',
      section_key: 'family', publisher_label_mode: 'PSEUDONYM', publisher_display_label: 'سائر', privacy_notes: ['CONTACT_NUMBER'] }]) });
    await expect(service(pending).preview(TOKEN, DRAFT)).resolves.toMatchObject({ readiness: 'ACKNOWLEDGEMENT_REQUIRED', text: '', privacyNotes: ['CONTACT_NUMBER'] });
    for (const outcome of ['ACKNOWLEDGEMENT_REQUIRED', 'SOURCE_UNAVAILABLE', 'UNDERSTANDING_CHANGED', 'TOO_LARGE']) {
      await expect(service(repository({ prepare: jest.fn(async () => [{ outcome, experience_id: null, current_lifecycle: null }]) }))
        .prepare(TOKEN, DRAFT, { commandId: COMMAND, expectedRevision: 3 })).resolves.toEqual({ outcome, experienceId: null });
    }
  });
});

describe('S8A-05 CP1 — the human title in the field, search and panel', () => {
  const entry = (n: number) => ({ experience_id: id(n), world_x: `${n}`, world_y: `-${n}`, meaning: `meaning ${n}`, semantic_region: `region.${n}` });
  const PANEL = { ...entry(3), version_ordinal: 1, primary_themes: [], secondary_themes: [], publisher_label_mode: 'PSEUDONYM',
    publisher_display_label: 'سائر', published_at: '2026-10-26T10:00:00Z', discussion_post_count: 0, qandeel_response_count: 0 };
  function fieldRepository(overrides: Partial<Record<keyof PublicFieldRepository, jest.Mock>> = {}) {
    return {
      field: jest.fn(async () => [entry(3), entry(5)]),
      search: jest.fn(async () => [entry(5), entry(3)]),
      experience: jest.fn(async () => [PANEL]),
      // S8A-05 CP2 (controlled re-anchor): the panel's content is the first page of the 0180 paged read.
      topicItems: jest.fn(async () => [{ item_count: 1, page: 1, page_count: 1, items: [{ position: 1, role: 'SOURCE_CONTENT', message: null,
        emphasized: false, gapBefore: false, text: TEXT }] }]),
      nearby: jest.fn(async () => [entry(5)]),
      relations: jest.fn(async () => []),
      topicHeaders: jest.fn(async () => [{ experience_id: id(3), title: TITLE, section_key: 'life_changes' }]),
      titleSearch: jest.fn(async () => [entry(3)]),
      sectionSearch: jest.fn(async () => [entry(3)]),
      ...overrides,
    };
  }
  const field = (repo = fieldRepository()) => new PublicFieldService(repo as unknown as PublicFieldRepository);

  it('carries the title and section of an authored topic; an untitled Experience keeps its meaning alone', async () => {
    const repo = fieldRepository();
    await expect(field(repo).field(TOKEN, { minX: '0', minY: '-9', maxX: '9', maxY: '0' })).resolves.toEqual({ experiences: [
      { id: id(3), x: '3', y: '-3', meaning: 'meaning 3', region: 'region.3', title: TITLE, section: 'life_changes' },
      { id: id(5), x: '5', y: '-5', meaning: 'meaning 5', region: 'region.5' }] });
    expect(repo.topicHeaders).toHaveBeenCalledWith(TOKEN, [id(3), id(5)]);
  });

  it('searches titles first, then meanings, each Experience once', async () => {
    const repo = fieldRepository();
    const { results } = await field(repo).search(TOKEN, { q: 'جديد' });
    expect(results.map((r) => r.id)).toEqual([id(3), id(5)]);
    expect(results[0]).toMatchObject({ title: TITLE });
    expect(repo.titleSearch).toHaveBeenCalledWith(TOKEN, 'جديد');
  });

  it('searches inside ONE section with { q, section }: one read over title, meaning, themes and text; nothing else asked', async () => {
    const repo = fieldRepository();
    const { results } = await field(repo).search(TOKEN, { q: 'جديد', section: 'life_changes' });
    expect(results).toEqual([{ id: id(3), x: '3', y: '-3', meaning: 'meaning 3', region: 'region.3', title: TITLE, section: 'life_changes' }]);
    expect(repo.sectionSearch).toHaveBeenCalledWith(TOKEN, 'جديد', 'life_changes');
    expect(repo.titleSearch).not.toHaveBeenCalled();
    expect(repo.search).not.toHaveBeenCalled();
    for (const query of [{ q: 'x', section: 'news' }, { q: 'x', section: '' }, { q: 'x', section: ['love'] }, { section: 'love' },
      { q: 'x', section: 'love', lens: 'y' }]) {
      expect(() => field(repo).search(TOKEN, query)).toThrow(BadRequestException);
    }
  });

  it('titles the panel, its nearby and its relations', async () => {
    const served = await field().experience(TOKEN, id(3));
    expect(served).toMatchObject({ state: 'SERVED', experience: { id: id(3), title: TITLE, section: 'life_changes' }, nearby: [{ id: id(5) }] });
    expect(served.state === 'SERVED' ? served.nearby[0].title : 'absent').toBeUndefined();
  });

  it('refuses a header for an Experience it did not ask about, or an unknown section', async () => {
    const stray = fieldRepository({ topicHeaders: jest.fn(async () => [{ experience_id: id(9), title: TITLE, section_key: null }]) });
    await expect(field(stray).field(TOKEN, { minX: '0', minY: '-9', maxX: '9', maxY: '0' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    const odd = fieldRepository({ topicHeaders: jest.fn(async () => [{ experience_id: id(3), title: TITLE, section_key: 'news' }]) });
    await expect(field(odd).field(TOKEN, { minX: '0', minY: '-9', maxX: '9', maxY: '0' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    const none = fieldRepository({ field: jest.fn(async () => []) });
    await expect(field(none).field(TOKEN, { minX: '0', minY: '-9', maxX: '9', maxY: '0' })).resolves.toEqual({ experiences: [] });
    expect(none.topicHeaders).not.toHaveBeenCalled();
  });

  // S8A-05 CP2 — a reader's pages of a served topic.
  const sealed = (position: number, role: string, emphasized = false, gapBefore = false) =>
    ({ position, role, message: position, emphasized, gapBefore, text: `item ${position}` });

  it('serves the panel the first page only, each sealed item with its speaker, emphasis and gap — never a Session Position', async () => {
    const repo = fieldRepository({ topicItems: jest.fn(async () => [{ item_count: 120, page: 1, page_count: 3,
      items: [sealed(1, 'WRITTEN'), sealed(2, 'YOUR_MESSAGE', true), sealed(3, 'QANDEEL_REPLY', false, true)] }]) });
    const served = await field(repo).experience(TOKEN, id(3));
    expect(served).toMatchObject({ state: 'SERVED', contentPages: { itemCount: 120, pageCount: 3 }, content: [
      { ordinal: 1, kind: 'SOURCE_CONTENT', text: 'item 1', role: 'WRITTEN', message: 1, emphasized: false, gapBefore: false },
      { ordinal: 2, kind: 'SOURCE_CONTENT', text: 'item 2', role: 'YOUR_MESSAGE', message: 2, emphasized: true, gapBefore: false },
      { ordinal: 3, kind: 'ANALYSIS', text: 'item 3', role: 'QANDEEL_REPLY', message: 3, emphasized: false, gapBefore: true }] });
    expect(repo.topicItems).toHaveBeenCalledWith(TOKEN, id(3), 1);
    expect(JSON.stringify(served)).not.toMatch(/sessionPosition/u);
  });

  it('pages a served topic by ?page=N, and refuses an author-side item shape or an unknown role', async () => {
    const repo = fieldRepository({ topicItems: jest.fn(async () => [{ item_count: 120, page: 3, page_count: 3, items: [sealed(101, 'QANDEEL_UNDERSTANDING')] }]) });
    await expect(field(repo).items(TOKEN, id(3), { page: '3' })).resolves.toEqual({ state: 'SERVED', itemCount: 120, page: 3, pageCount: 3, items: [
      { ordinal: 101, kind: 'ANALYSIS', text: 'item 101', role: 'QANDEEL_UNDERSTANDING', message: 101, emphasized: false, gapBefore: false }] });
    expect(repo.topicItems).toHaveBeenCalledWith(TOKEN, id(3), 3);
    await expect(field(fieldRepository({ topicItems: jest.fn(async () => []) })).items(TOKEN, id(3), {})).resolves.toEqual({ state: 'UNAVAILABLE' });
    await expect(field().items(TOKEN, 'guess', {})).resolves.toEqual({ state: 'UNAVAILABLE' });
    const positioned = fieldRepository({ topicItems: jest.fn(async () => [{ item_count: 1, page: 1, page_count: 1,
      items: [{ ...sealed(1, 'YOUR_MESSAGE'), sessionPosition: 7 }] }]) });
    await expect(field(positioned).items(TOKEN, id(3), {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    const odd = fieldRepository({ topicItems: jest.fn(async () => [{ item_count: 1, page: 1, page_count: 1, items: [sealed(1, 'HIM')] }]) });
    await expect(field(odd).items(TOKEN, id(3), {})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(() => field().items(TOKEN, id(3), { page: '1', viewer: 'x' })).toThrow(BadRequestException);
  });
});

describe('S8A-05 CP1 — the static boundary', () => {
  const source = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
  const FILES = ['public-compose.repository.ts', 'public-compose.service.ts', 'public-compose.controller.ts'];

  it('logs nothing, binds no provider, names no user, Public ref, approver or clearance', () => {
    for (const file of FILES) {
      const text = source(file);
      expect(text).not.toMatch(/console\.|Logger|ModelRouter|memory|humanIntelligence|replay|voice/iu);
      expect(text).not.toMatch(/openai|anthropic|gemini|qwen|deepseek|claude|kimi|glm|gpt-/iu);
      expect(text).not.toMatch(/p_user|p_viewer|public_identity_ref|p_approver|p_clearance|server\.rpc|publish_/u);
    }
  });

  it('calls exactly the 0179 owner commands on the caller token', () => {
    const calls = [...source('public-compose.repository.ts').matchAll(/this\.rpc<[A-Za-z]+>\(token, '([a-z_]+_v1)'/gu)].map((m) => m[1]).sort();
    // S8A-05 CP2 (controlled re-anchor): plus the five 0180 owner commands and reads on the same caller token. The
    // «فهم قنديل» source is chosen through the Understanding boundary, which alone resolves its opaque ref.
    expect(calls).toEqual(['acknowledge_own_topic_source_v1', 'clear_own_topic_source_v1', 'delete_own_topic_draft_v1', 'discard_own_unpublished_topic_v1',
      'freeze_own_topic_draft_v1', 'list_own_topic_drafts_v1', 'preview_own_topic_draft_v1', 'read_own_topic_draft_v1', 'read_own_topic_items_v1',
      'read_own_topic_source_v1', 'save_own_topic_draft_v1', 'set_own_topic_conversation_source_v1', 'set_own_topic_section_v1']);
  });

  it('classifies every route, preparation strictly, and adds no publish route', () => {
    const routes = Object.entries(ROUTE_RATE_LIMIT_CENSUS).filter(([route]) => route.includes('/public/compose/'));
    expect(Object.fromEntries(routes)).toEqual({
      'GET /public/compose/drafts': 'AUTHENTICATED',
      'GET /public/compose/drafts/:draftId': 'AUTHENTICATED',
      'PUT /public/compose/drafts/:draftId': 'AUTHENTICATED',
      'POST /public/compose/drafts/:draftId/delete': 'AUTHENTICATED',
      'GET /public/compose/drafts/:draftId/preview': 'AUTHENTICATED',
      'POST /public/compose/drafts/:draftId/prepare': 'SECURITY_SENSITIVE',
      'POST /public/compose/topics/:experienceId/discard': 'AUTHENTICATED',
      'POST /public/compose/topics/:experienceId/section': 'AUTHENTICATED',
      // S8A-05 CP2 (controlled re-anchor): the source, its acknowledgement and the paged items (0180).
      'GET /public/compose/drafts/:draftId/source': 'AUTHENTICATED',
      'PUT /public/compose/drafts/:draftId/source/conversation': 'SECURITY_SENSITIVE',
      'POST /public/compose/drafts/:draftId/source/clear': 'AUTHENTICATED',
      'POST /public/compose/drafts/:draftId/source/acknowledge': 'AUTHENTICATED',
      'GET /public/compose/drafts/:draftId/items': 'AUTHENTICATED',
      // A reader's page of a served topic: a viewer read, here so the frozen S5-03B field controller keeps its routes.
      'GET /public/compose/topics/:experienceId/items': 'AUTHENTICATED',
    });
    expect(Object.keys(ROUTE_RATE_LIMIT_CENSUS).filter((route) => /publish/u.test(route))).toEqual([]);
  });
});
