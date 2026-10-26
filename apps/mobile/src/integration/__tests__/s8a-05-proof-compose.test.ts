/**
 * S8A-05 CP1 — the «Write your topic» device-proof stand-in (VALIDATION fixture guard).
 *
 * The S4-01 proof world answers `/public/compose/*` and the human titles only after `topics()` (so every earlier device
 * leg meets the proof world exactly as before), and what it answers is what the production strict client accepts — so a
 * device photograph cannot silently show a fallback state.
 */
import { PublicWorldApiClient, publicEntryLabel } from '../../runtime-entry';
import { PUBLIC_FIELD_MAX_COORD, PUBLIC_FIELD_MIN_COORD } from '../../public-world/field/public-field-camera';
import { createS401ProofWorld } from '../__validation__/s401-proof-world';

const WHOLE = { minX: PUBLIC_FIELD_MIN_COORD, minY: PUBLIC_FIELD_MIN_COORD, maxX: PUBLIC_FIELD_MAX_COORD, maxY: PUBLIC_FIELD_MAX_COORD };

describe('S8A-05 CP1 — the proof world «Write your topic» stand-in', () => {
  it('answers nothing until topics(), then the strict client accepts the draft, the preview and the closed preparation', async () => {
    const world = createS401ProofWorld('ar');
    const api = new PublicWorldApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch });
    expect(await api.compose.drafts()).toEqual({ kind: 'NO_ANSWER' });
    world.topics();
    const drafts = await api.compose.drafts();
    expect(drafts.kind === 'ANSWER' && drafts.value.map((d) => [d.title, d.section, d.state])).toEqual([['كيف تعلّمت أن أطلب المساعدة', 'inner_self', 'EDITING']]);
    const draftId = drafts.kind === 'ANSWER' ? drafts.value[0].draftId : '';
    const read = await api.compose.draft(draftId);
    expect(read.kind === 'ANSWER' && read.value.kind).toBe('DRAFT');
    expect(await api.compose.save(draftId, 1, 'كيف تعلّمت أن أطلب المساعدة', 'نص', 'inner_self')).toEqual({ kind: 'ANSWER', value: { outcome: 'SAVED', revision: 2 } });
    expect(await api.compose.save(draftId, 1, 'x', 'y', null)).toEqual({ kind: 'ANSWER', value: { outcome: 'STALE', revision: 2 } });
    const preview = await api.compose.preview(draftId);
    expect(preview.kind === 'ANSWER' && preview.value.kind === 'PREVIEW' && [preview.value.preview.readiness, preview.value.preview.text]).toEqual(['READY', 'نص']);
    expect(await api.compose.prepare(draftId, '58050000-0000-4000-8000-0000000000ff', 2)).toEqual({ kind: 'ANSWER', value: 'PUBLICATION_NOT_OPEN' });
  });

  it('titles four fixture Experiences only after topics(), as the strict field client accepts them', async () => {
    const world = createS401ProofWorld('ar');
    const field = new PublicWorldApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch }).field;
    world.publicSeed();
    const before = await field.field(WHOLE);
    expect(before.kind === 'ANSWER' && before.value.filter((e) => e.title !== undefined).length).toBe(0);
    world.topics();
    const after = await field.field(WHOLE);
    const titled = after.kind === 'ANSWER' ? after.value.filter((e) => e.title !== undefined) : [];
    expect(titled.map(publicEntryLabel)).toEqual(expect.arrayContaining(['حين خفت أن أخذل أهلي', 'سنة من الإرهاق في العمل']));
    expect(titled).toHaveLength(4);
    const panel = await field.experience(titled[0].id);
    expect(panel.kind === 'ANSWER' && panel.value.kind === 'SERVED' && panel.value.experience.entry.title).toBe(titled[0].title);
  });
});
