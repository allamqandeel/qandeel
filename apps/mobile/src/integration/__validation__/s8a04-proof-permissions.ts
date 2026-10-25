/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in a Shared World, for the device proof. VALIDATION ONLY.
 *
 * An in-memory stand-in answering the four permission routes as `apps/api/src/shared-world/shared-world-permissions.*` and
 * migration 0177 do, for the reader of the S4-01 proof world as the OWNER (the database's own rules — membership episodes,
 * the relevance read, the judge, races — are the real-PostgreSQL verifiers' and the integrated proof's, not this fixture's):
 *
 *   - GET  …/permissions — the reader's own items in ONE current World: the open request, what they allowed (or, once the
 *     audience grew past the members they allowed, what waits for their reconfirmation, naming the new members), what they
 *     declined or withdrew, and what ended; the other members by name in join order and an opaque audience reference;
 *   - POST …/requests/:id/answer, …/items/:id/allow, …/items/:id/withdraw — one answer per command; an ALLOW over a
 *     reference that is not the current audience is AUDIENCE_CHANGED and changes nothing; withdrawing moves the item to
 *     the declined list (from where «اسمح الآن» allows it again), as the server does.
 *
 * Nothing here posts to the conversation or to Activity. Every item text is SYNTHETIC validation text, never Product copy
 * and never a real person's.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

type Bilingual = { readonly ar: string; readonly en: string };
/** SYNTHETIC items of the reader — validation text, not copy. One carries a number, one a Latin word, for the bidi check. */
export const S8A04_PROOF_ITEMS = Object.freeze({
  request: { ar: 'أفضّل السفر بالقطار في الرحلات الطويلة', en: 'I prefer the train for long trips' },
  allowed: { ar: 'أمشي 10 آلاف خطوة كل يوم', en: 'I walk 10,000 steps every day' },
  declined: { ar: 'أتوتر من السفر بالليل', en: 'Night travel makes me nervous' },
  left: { ar: 'أحب قهوة V60 في الصباح', en: 'I like V60 coffee in the morning' },
  forgotten: { ar: 'أنام مبكرًا قبل السفر', en: 'I sleep early before a trip' },
} satisfies Record<string, Bilingual>);

type State = 'REQUEST' | 'ALLOWED' | 'DECLINED' | 'ENDED';
type Ending = 'LEFT' | 'CORRECTED' | 'FORGOTTEN' | 'TURNED_OFF' | 'NO_LONGER_CURRENT';
interface Item { itemId: string; requestId: string | null; text: string; state: State; ceiling: string[]; ending: Ending | null }
type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };

export interface S8a04ProofPermissionsWorld {
  /** The World's other current members' keys, in join order, and the name each is shown by. */
  readonly others: (worldId: string) => readonly string[] | null;
  readonly nameOf: (key: string) => string;
}

export interface S8a04ProofPermissions {
  /** The reader's items in `worldId`: one open request, one allowed, one declined, two ended (LEFT, FORGOTTEN). */
  seed(worldId: string): void;
  /** Every allowed item ends because the reader corrected it. */
  correct(): void;
  routes(path: string, method: string, body: Record<string, unknown> | undefined): Promise<Reply> | null;
}

export function createS8a04ProofPermissions(language: ChromeLanguage, world: S8a04ProofPermissionsWorld,
  uuid: () => string): S8a04ProofPermissions {
  const items = new Map<string, Item[]>();
  const answered = new Map<string, unknown>();
  const json = (status: number, body: unknown): Reply => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  /** An opaque reference of exactly these members (validation only: a fixed-width hex of their keys). */
  const refOf = (keys: readonly string[]) => {
    let hex = '';
    for (const char of [...keys].sort().join(',')) hex += char.charCodeAt(0).toString(16).padStart(4, '0');
    return `sha256:${(hex + '0'.repeat(64)).slice(0, 64)}`;
  };
  const isRef = (value: unknown): value is string => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
  const once = (commandId: unknown, work: () => unknown): Reply => {
    if (typeof commandId !== 'string' || commandId.length === 0) return json(400, { outcome: 'INVALID_REQUEST' });
    if (!answered.has(commandId)) answered.set(commandId, work());
    return json(200, answered.get(commandId));
  };

  function view(worldId: string, others: readonly string[]) {
    const own = items.get(worldId) ?? [];
    const out = { requests: [] as unknown[], allowed: [] as unknown[], reconfirm: [] as unknown[], declined: [] as unknown[], ended: [] as unknown[] };
    for (const item of own) {
      if (item.state === 'REQUEST') out.requests.push({ requestId: item.requestId, itemId: item.itemId, text: item.text });
      if (item.state === 'DECLINED') out.declined.push({ itemId: item.itemId, text: item.text });
      if (item.state === 'ENDED') out.ended.push({ itemId: item.itemId, text: item.ending === 'FORGOTTEN' ? null : item.text, reason: item.ending });
      if (item.state === 'ALLOWED') {
        const added = others.filter((key) => !item.ceiling.includes(key));
        if (added.length === 0) out.allowed.push({ itemId: item.itemId, text: item.text });
        else out.reconfirm.push({ itemId: item.itemId, text: item.text, newMembers: added.map(world.nameOf) });
      }
    }
    const any = own.length > 0;
    return { outcome: 'READ', audienceRef: any ? refOf(others) : null, members: any ? others.map(world.nameOf) : [], ...out };
  }

  return {
    seed(worldId) {
      const others = world.others(worldId) ?? [];
      const make = (text: Bilingual, state: State, ending: Ending | null = null): Item => ({
        itemId: uuid(), requestId: state === 'REQUEST' ? uuid() : null, text: text[language], state, ceiling: state === 'ALLOWED' ? [...others] : [], ending,
      });
      items.set(worldId, [
        make(S8A04_PROOF_ITEMS.request, 'REQUEST'),
        make(S8A04_PROOF_ITEMS.allowed, 'ALLOWED'),
        make(S8A04_PROOF_ITEMS.declined, 'DECLINED'),
        make(S8A04_PROOF_ITEMS.left, 'ENDED', 'LEFT'),
        make(S8A04_PROOF_ITEMS.forgotten, 'ENDED', 'FORGOTTEN'),
      ]);
    },
    correct() {
      for (const own of items.values()) for (const item of own) if (item.state === 'ALLOWED') Object.assign(item, { state: 'ENDED', ending: 'CORRECTED' });
    },
    routes(path, method, body) {
      const read = /^\/shared\/worlds\/([0-9a-f-]+)\/permissions$/u.exec(path);
      const answer = /^\/shared\/worlds\/([0-9a-f-]+)\/permissions\/requests\/([0-9a-f-]+)\/answer$/u.exec(path);
      const act = /^\/shared\/worlds\/([0-9a-f-]+)\/permissions\/items\/([0-9a-f-]+)\/(allow|withdraw)$/u.exec(path);
      const worldId = read?.[1] ?? answer?.[1] ?? act?.[1];
      if (worldId === undefined) return null;
      const others = world.others(worldId);
      if (others === null) return Promise.resolve(json(200, { outcome: 'UNAVAILABLE' }));
      const own = items.get(worldId) ?? [];
      const current = refOf(others);
      if (read !== null && method === 'GET') return Promise.resolve(json(200, view(worldId, others)));
      if (answer !== null && method === 'POST') {
        const decision = body?.decision;
        if ((decision === 'ALLOW' && !isRef(body?.audienceRef)) || (decision !== 'ALLOW' && decision !== 'DECLINE')) return Promise.resolve(json(400, { outcome: 'INVALID_REQUEST' }));
        return Promise.resolve(once(body?.commandId, () => {
          const item = own.find((entry) => entry.state === 'REQUEST' && entry.requestId === answer[2]);
          if (item === undefined) return { outcome: 'UNAVAILABLE' };
          if (decision === 'DECLINE') { item.state = 'DECLINED'; return { outcome: 'DECLINED' }; }
          if (body?.audienceRef !== current) return { outcome: 'AUDIENCE_CHANGED' };
          Object.assign(item, { state: 'ALLOWED', ceiling: [...others] });
          return { outcome: 'ALLOWED' };
        }));
      }
      if (act !== null && method === 'POST') {
        if (act[3] === 'allow' && !isRef(body?.audienceRef)) return Promise.resolve(json(400, { outcome: 'INVALID_REQUEST' }));
        return Promise.resolve(once(body?.commandId, () => {
          const item = own.find((entry) => entry.itemId === act[2]);
          if (act[3] === 'withdraw') {
            if (item?.state !== 'ALLOWED') return { outcome: 'UNAVAILABLE' };
            item.state = 'DECLINED';
            return { outcome: 'WITHDRAWN' };
          }
          if (item === undefined || (item.state !== 'DECLINED' && item.state !== 'ALLOWED')) return { outcome: 'UNAVAILABLE' };
          if (body?.audienceRef !== current) return { outcome: 'AUDIENCE_CHANGED' };
          Object.assign(item, { state: 'ALLOWED', ceiling: [...others] });
          return { outcome: 'ALLOWED' };
        }));
      }
      return Promise.resolve(json(404, {}));
    },
  };
}
