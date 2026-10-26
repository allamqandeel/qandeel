/**
 * S8A-05 CP1 — the «اكتب موضوعك» / Write your topic device-proof stand-in. VALIDATION ONLY: reachable only in the S4-01
 * proof build (`select-s401-proof-entry.mjs --apply`), never in the production bundle.
 *
 * Until `qandeel://s401-proof/public/topics` nothing answers here, so the proof world behaves exactly as before. After it:
 *
 *   - `/public/compose/*` answers in the shapes `apps/api/src/public-world/public-compose.*` returns, deciding like 0179
 *     only as far as the screens need: one SYNTHETIC Arabic draft already saved, compare-and-set saves, the preview of
 *     exactly the saved words with its deterministic notes, and preparation answering PUBLICATION_NOT_OPEN (production
 *     publishing is closed; nothing here prepares or publishes anything);
 *   - a few fixture Experiences of `s503b-visual-field.ts` carry a SYNTHETIC human title and section, as the 0179 viewer
 *     reads serve them, so the map, search and panel show the title instead of the meaning; search also finds a title,
 *     and with `&section=` answers inside that section only, as `GET /public/field/search` does.
 *
 * Every title and text below is SYNTHETIC validation text — never Product copy, never a real person.
 */
type Json = Record<string, unknown>;
type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };

interface ProofDraft { draftId: string; revision: number; title: string; text: string; section: string | null; createdAt: string; updatedAt: string }

const SEEDED_DRAFT: Readonly<ProofDraft> = Object.freeze({
  draftId: '58050000-0000-4000-8000-000000000001',
  revision: 1,
  title: 'كيف تعلّمت أن أطلب المساعدة',
  text: 'سنوات طويلة كنت أظن أن طلب المساعدة ضعف.\nفي الشتاء الماضي تغيّر شيء، وبدأت أتكلم مع أخي عن تعبي في العمل.\nأكتب هذا لمن يمرّ بالشيء نفسه.',
  section: 'inner_self',
  createdAt: '2026-10-26T09:00:00.000Z',
  updatedAt: '2026-10-26T09:00:00.000Z',
});

/** SYNTHETIC human titles for four fixture Experiences (the first of four regions), by their deterministic ids. */
const TITLES: Readonly<Record<string, { readonly title: string; readonly section: string }>> = Object.freeze({
  '5503b000-0000-4000-8000-000000000001': { title: 'حين خفت أن أخذل أهلي', section: 'family' },
  '5503b000-0000-4000-8000-000000000011': { title: 'سنة من الإرهاق في العمل', section: 'work_money' },
  '5503b000-0000-4000-8000-000000000021': { title: 'صديق رحل قبل أن أودّعه', section: 'loss_crisis' },
  '5503b000-0000-4000-8000-000000000031': { title: 'بداية جديدة في مدينة أخرى', section: 'life_changes' },
});

const SECTIONS = ['love', 'marriage', 'family', 'parenting', 'people', 'work_money', 'study_future', 'inner_self', 'health_body', 'loss_crisis',
  'faith_meaning', 'life_changes', 'open'];

export interface S805ProofCompose {
  /** Opens the stand-in: the seeded draft and the titled fixture Experiences. */
  seed(): void;
  route(path: string, method: string, body: Json | undefined): Answer | undefined;
  /** The fixture entry with its SYNTHETIC title and section once seeded; unchanged before. */
  titled<T extends { readonly id: string }>(entry: T): T;
  /**
   * The search answer: title matches first, then `byMeaning` (the fixture's meaning / theme matches), each once, titled;
   * with a section, only that section's. `entryOf` reads one fixture entry by id.
   */
  search<T extends { readonly id: string }>(q: string, section: string | null, byMeaning: readonly T[], entryOf: (id: string) => T | null): T[];
}

/** `publisherLabel` answers the label the preview shows: the proof account's current Public ID or Name, as 0179 derives it. */
export function createS805ProofCompose(publisherLabel: () => { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string }): S805ProofCompose {
  let open = false;
  const drafts: ProofDraft[] = [];
  const json = (status: number, body: unknown): Answer => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const now = () => new Date().toISOString();
  const readiness = (d: ProofDraft) => (d.title.trim().length < 8 ? 'TITLE_TOO_SHORT' : d.text.trim() === '' ? 'TEXT_REQUIRED' : d.section === null ? 'SECTION_REQUIRED' : 'READY');
  const notes = (text: string) => [
    ...(/([0-9][ .-]?){7,}[0-9]/u.test(text) ? ['CONTACT_NUMBER'] : []),
    ...(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u.test(text) ? ['EMAIL_ADDRESS'] : []),
    ...(/(https?:\/\/|www\.)/iu.test(text) ? ['LINK'] : []),
  ];

  return {
    seed: () => {
      if (open) return;
      open = true;
      drafts.push({ ...SEEDED_DRAFT });
    },
    titled: (entry) => (open && TITLES[entry.id] !== undefined ? { ...entry, ...TITLES[entry.id] } : entry),
    search(q, section, byMeaning, entryOf) {
      const needle = q.trim();
      const byTitle = open ? Object.entries(TITLES).filter(([, t]) => t.title.includes(needle)).map(([id]) => entryOf(id)) : [];
      const seen = new Set<string>();
      const all = [...byTitle, ...byMeaning].filter((e): e is NonNullable<typeof e> => e !== null && !seen.has(e.id) && (seen.add(e.id), true));
      const titled = all.map((e) => (open && TITLES[e.id] !== undefined ? { ...e, ...TITLES[e.id] } : e));
      return (section === null ? titled : titled.filter((e) => (e as { section?: string }).section === section)).slice(0, 20);
    },
    route(path, method, body) {
      if (!open || !path.startsWith('/public/compose/')) return undefined;
      if (path === '/public/compose/drafts' && method === 'GET') {
        return json(200, { drafts: [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((d) => ({
          draftId: d.draftId, revision: d.revision, title: d.title, section: d.section, textLength: d.text.length, state: 'EDITING',
          experienceId: null, updatedAt: d.updatedAt })) });
      }
      const m = /^\/public\/compose\/drafts\/([^/]+)(?:\/(delete|preview|prepare))?$/u.exec(path);
      if (m === null) return json(404, {});
      const draftId = decodeURIComponent(m[1]);
      const found = drafts.find((d) => d.draftId === draftId);
      if (m[2] === undefined && method === 'GET') {
        return json(200, found === undefined ? { state: 'UNAVAILABLE' } : { state: 'EDITING', draftId, revision: found.revision, title: found.title,
          text: found.text, section: found.section, experienceId: null, createdAt: found.createdAt, updatedAt: found.updatedAt });
      }
      if (m[2] === undefined && method === 'PUT') {
        const { expectedRevision, title, text, section } = body as { expectedRevision: number; title: string; text: string; section: string | null };
        if (title.length > 100 || text.length > 5000 || (section !== null && !SECTIONS.includes(section))) return json(200, { outcome: 'INVALID', revision: null });
        if (found === undefined) {
          if (expectedRevision !== 0) return json(200, { outcome: 'NOT_FOUND', revision: null });
          drafts.push({ draftId, revision: 1, title, text, section, createdAt: now(), updatedAt: now() });
          return json(200, { outcome: 'CREATED', revision: 1 });
        }
        if (expectedRevision !== found.revision) return json(200, { outcome: 'STALE', revision: found.revision });
        Object.assign(found, { revision: found.revision + 1, title, text, section, updatedAt: now() });
        return json(200, { outcome: 'SAVED', revision: found.revision });
      }
      if (m[2] === 'delete' && method === 'POST') {
        if (found === undefined) return json(200, { outcome: 'NOT_FOUND' });
        drafts.splice(drafts.indexOf(found), 1);
        return json(200, { outcome: 'DELETED' });
      }
      if (m[2] === 'preview' && method === 'GET') {
        if (found === undefined) return json(200, { state: 'UNAVAILABLE' });
        return json(200, { state: 'CURRENT', revision: found.revision, readiness: readiness(found), title: found.title.trim(), text: found.text.trim(),
          section: found.section, publisher: publisherLabel(),
          privacyNotes: [...notes(found.text), ...(publisherLabel().mode === 'REAL_NAME' ? ['SHOWN_UNDER_REAL_NAME'] : [])] });
      }
      // Production publishing is closed: the freeze seam answers first, and nothing is prepared.
      if (m[2] === 'prepare' && method === 'POST') return json(200, { outcome: 'PUBLICATION_NOT_OPEN', experienceId: null });
      return json(404, {});
    },
  };
}
