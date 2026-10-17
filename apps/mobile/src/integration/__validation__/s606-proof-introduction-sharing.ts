/**
 * S6-06 — the progressive disclosure, photo, display-name, SUCCESS and resume device-proof stand-in. VALIDATION ONLY:
 * reachable only in the S4-01 proof build (`select-s401-proof-entry.mjs --apply`), never in the production bundle. It exists
 * so the approved screens P0 – P16 can be photographed on a device and the device's cache directories inspected after the
 * flows; it proves NOTHING about the server, whose truth is verify-migration-0162 / 0163 and their live proofs.
 *
 * Until it is seeded nothing answers here, so every earlier proof leg meets the proof world exactly as before. It joins the
 * S6-05 stand-in's live Introduction with «ريم» / Reem (seed that first).
 *
 *   qandeel://s401-proof/introductions/seed-sharing    the other person has shared a home town and the first photo stage; the
 *                                                       reader's participation is paused after an earlier Introduction
 *   qandeel://s401-proof/introductions/sharing-closed  every later share answers NOT_AVAILABLE_NOW (production's answer today)
 *   qandeel://s401-proof/introductions/sharing-open    shares are answered again (as only a CLEARED CW2-08 seam would)
 *   qandeel://s401-proof/introductions/sharing-more    the other person shares the clear stage and consents to their full name
 *   qandeel://s401-proof/introductions/sharing-success a transition exists (as only Stage 8A would produce one)
 *   qandeel://s401-proof/introductions/sharing-complete the next approval completes it
 *
 * It answers in the exact shapes of `apps/api/src/introductions-disclosure` and `apps/api/src/introductions-continuation`;
 * a command id answers the same way when it is sent again. A photo's bytes are taken from the picker as the app sends them
 * and only their presence is checked; its three stages are the approved D-04 renditions.
 *
 * A rendition is answered through the PLATFORM'S OWN network stack, so the app draws it exactly as it would the API's: the
 * stand-in asks the proof media server on the host (`PROOF_MEDIA_ORIGIN`, the emulator's alias of the host) for the bytes
 * the CP1 pipeline produced at 12 / 48 / 1600 from two SYNTHETIC drawn images, answered `Cache-Control: no-store, private`
 * like the API, and hands the platform's own response to the app. It writes nothing on the device, so the cache scan after
 * the flows sees what the APP left, only. Without that server a rendition simply fails to arrive (the retry is shown).
 */
import type { ChromeLanguage } from '../../orientation-chrome';

/** The proof media server, on the host, as the Android emulator reaches it. Validation tooling only. */
const PROOF_MEDIA_ORIGIN = 'http://10.0.2.2:8787/renditions';
const RENDITIONS = {
  warm: ['warm-strong-12.jpg', 'warm-medium-48.jpg', 'warm-clear-1600.jpg'],
  sky: ['sky-strong-12.jpg', 'sky-medium-48.jpg', 'sky-clear-1600.jpg'],
} as const;

type Json = Record<string, unknown>;
type Answer = { ok: boolean; status: number; json: () => Promise<unknown>; blob?: () => Promise<Blob> };
type Stage = 1 | 2 | 3;
interface Text { kind: 'TEXT'; mine: boolean; materialId: string; versionId: string; resourceType: string; fieldKey: string | null; text: string; at: string }
interface Image { kind: 'IMAGE'; mine: boolean; materialId: string; versionId: string; stage: Stage; handle: string; seriesId: string | null; at: string }

const TEXT = {
  ar: { town: 'الإسكندرية', otherFull: 'ريم عادل' },
  en: { town: 'Alexandria', otherFull: 'Reem Adel' },
} as const;

const ID = (n: number) => `56060000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** The S6-05 stand-in's live and ended Worlds. */
const W_LIVE = '56050000-0000-4000-8000-000000000011';
const W_ENDED = '56050000-0000-4000-8000-000000000012';
const EVENT = ID(900);
const CONTACT = /(?:\d[\s-]?){7,}|@|https?:\/\//u;

export interface S606ProofIntroductionSharing {
  /** An answer for one of its routes, `undefined` for anything else. */
  route(path: string, method: string, body: unknown): Promise<Answer> | undefined;
  seed(): void;
  closeGate(): void;
  openGate(): void;
  more(): void;
  success(): void;
  complete(): void;
}

export function createS606ProofIntroductionSharing(language: ChromeLanguage): S606ProofIntroductionSharing {
  const t = TEXT[language];
  let seeded = false;
  let gateOpen = true;
  let next = 100;
  let clock = 0;
  let items: (Text | Image)[] = [];
  let series: { id: string; state: 'READY' | 'DISCLOSING'; handles: Record<Stage, string> } | null = null;
  let displayed: string | null = null;
  let otherFull = false;
  let transition: 'NONE' | 'TRANSITION' | 'COMPLETES' | 'COMPLETED' = 'NONE';
  let myApproval: 'NONE' | 'APPROVED' | 'WITHDRAWN' = 'NONE';
  let approvalEvent: string | null = null;
  const media = new Map<string, string>();
  const answered = new Map<string, Json>();
  const at = () => new Date(Date.UTC(2026, 9, 17, 10, 0, clock++)).toISOString().replace('Z', '+00:00');
  const json = (status: number, body: unknown): Promise<Answer> => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
  const replay = (command: unknown, make: () => Json): Promise<Answer> => {
    if (typeof command !== 'string') return json(400, { outcome: 'INVALID_REQUEST' });
    const earlier = answered.get(command);
    if (earlier !== undefined) return json(200, earlier);
    const answer = make();
    answered.set(command, answer);
    return json(200, answer);
  };
  const theirStage = (stage: Stage) => {
    const handle = ID(next++);
    media.set(handle, RENDITIONS.sky[stage - 1]);
    items = items.filter((i) => !(i.kind === 'IMAGE' && !i.mine));
    items.push({ kind: 'IMAGE', mine: false, materialId: ID(next++), versionId: ID(next++), stage, handle, seriesId: null, at: at() });
  };
  const out = (i: Text | Image): Json => (i.kind === 'TEXT'
    ? { kind: 'TEXT', mine: i.mine, materialId: i.materialId, versionId: i.versionId, resourceType: i.resourceType, fieldKey: i.fieldKey, text: i.text, stage: null, handle: null, seriesId: null, establishedAt: i.at }
    : { kind: 'IMAGE', mine: i.mine, materialId: i.materialId, versionId: i.versionId, resourceType: i.stage === 3 ? 'FULL_IMAGE' : 'PARTIAL_IMAGE', fieldKey: null, text: null, stage: i.stage, handle: i.handle, seriesId: i.seriesId, establishedAt: i.at });
  const view = (worldId: string): Json => {
    const shared = new Set(items.flatMap((i) => (i.kind === 'IMAGE' && i.mine ? [i.stage] : [])));
    const unshared = series === null ? [] : ([1, 2, 3] as const).filter((s) => !shared.has(s)).map((stage) => ({ stage, handle: series!.handles[stage] }));
    const ended = worldId === W_ENDED;
    return {
      outcome: 'READY', introductionState: ended ? 'ENDED' : 'ACTIVE', items: ended ? [] : items.map(out),
      myPhoto: ended || series === null || unshared.length === 0 ? null : { seriesId: series.id, state: series.state, unsharedStages: unshared },
      myDisplayedVersionId: ended ? null : displayed, otherDisplayName: !ended && otherFull ? t.otherFull : null,
    };
  };

  /** The platform's own network stack: the proof media server's response, handed to the app as the API's would be. */
  const rendition = async (name: string): Promise<Answer> => (await globalThis.fetch(`${PROOF_MEDIA_ORIGIN}/${name}`, { headers: { Accept: 'image/jpeg' } })) as unknown as Answer;

  return {
    seed() {
      seeded = true;
      gateOpen = true;
      items = [{ kind: 'TEXT', mine: false, materialId: ID(1), versionId: ID(2), resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city', text: t.town, at: at() }];
      theirStage(1);
      series = null;
      displayed = null;
      otherFull = false;
      transition = 'NONE';
      myApproval = 'NONE';
      approvalEvent = null;
      answered.clear();
    },
    closeGate() { gateOpen = false; },
    openGate() { gateOpen = true; },
    more() {
      theirStage(3);
      otherFull = true;
    },
    success() { transition = 'TRANSITION'; },
    complete() { transition = 'COMPLETES'; },
    route(path, method, body) {
      if (!seeded) return undefined;
      const world = /^\/introductions\/worlds\/([0-9a-f-]{36})\/(disclosures(?:\/text)?|image\/[0-9a-f-]{36}|image-stages|image-removal|media\/[0-9a-f-]{36}|display-name\/(?:grant|revoke)|success(?:\/approval|\/withdrawal)?)$/u.exec(path);
      const deletion = /^\/shared\/worlds\/([0-9a-f-]{36})\/materials\/([0-9a-f-]{36})\/delete$/u.exec(path);
      if (deletion !== null && method === 'POST' && items.some((i) => i.materialId === deletion[2])) {
        const b = body as Json;
        return replay(b?.commandId, () => {
          items = items.filter((i) => i.materialId !== deletion[2]);
          return { outcome: 'DELETED' };
        });
      }
      if (path === '/introductions/shares' && method === 'GET') {
        const mine = items.filter((i) => i.mine);
        return json(200, { outcome: 'READY', worlds: mine.length === 0 ? [] : [{ worldId: W_LIVE, introductionState: 'ACTIVE', otherFirstName: language === 'ar' ? 'ريم' : 'Reem',
          shares: mine.map((i) => (i.kind === 'TEXT'
            ? { materialId: i.materialId, versionId: i.versionId, resourceType: i.resourceType, fieldKey: i.fieldKey, text: i.text, seriesId: null, stage: null, displayed: displayed === i.versionId, establishedAt: i.at }
            : { materialId: i.materialId, versionId: i.versionId, resourceType: i.stage === 3 ? 'FULL_IMAGE' : 'PARTIAL_IMAGE', fieldKey: null, text: null, seriesId: i.seriesId, stage: i.stage, displayed: false, establishedAt: i.at })) }] });
      }
      if (path === '/introductions/participation' && method === 'GET') {
        return json(200, { outcome: 'READY', state: 'PAUSED', pauseReason: 'POST_INTRODUCTION', expectedEventId: EVENT });
      }
      if (path === '/introductions/participation/resume' && method === 'POST') {
        return replay((body as Json)?.commandId, () => ({ outcome: 'NOT_AVAILABLE_NOW', participation_state: null }));
      }
      if (world === null || (world[1] !== W_LIVE && world[1] !== W_ENDED)) return undefined;
      const [, worldId, route] = world;
      const b = (body ?? {}) as Json;
      if (route === 'disclosures' && method === 'GET') return json(200, view(worldId));
      if (route === 'disclosures/text' && method === 'POST') {
        return replay(b.commandId, () => {
          if (!gateOpen) return { outcome: 'NOT_AVAILABLE_NOW', disclosed_material_id: null, disclosed_at: null, outcomeOnly: true };
          if (b.resourceType !== 'CONTACT_METHOD' && typeof b.text === 'string' && CONTACT.test(b.text)) return { outcome: 'CONTACT_REFUSED', outcomeOnly: true };
          const item: Text = { kind: 'TEXT', mine: true, materialId: ID(next++), versionId: ID(next++), resourceType: String(b.resourceType), fieldKey: (b.fieldKey as string | null) ?? null, text: String(b.text), at: at() };
          items.push(item);
          return { outcome: 'DISCLOSED', materialId: item.materialId, disclosedAt: item.at };
        }).then((answer) => strip(answer));
      }
      if (route.startsWith('image/') && method === 'POST') {
        const command = route.slice(6);
        const earlier = answered.get(command);
        if (earlier !== undefined) return json(200, earlier);
        let answer: Json;
        if (!gateOpen) answer = { outcome: 'NOT_AVAILABLE_NOW' };
        else if (!(body instanceof Uint8Array) || body.length === 0) answer = { outcome: 'IMAGE_REFUSED', reason: 'MALFORMED' };
        else if (series !== null) answer = { outcome: 'PHOTO_ACTIVE' };
        else {
          const handles = { 1: ID(next++), 2: ID(next++), 3: ID(next++) } as Record<Stage, string>;
          ([1, 2, 3] as const).forEach((s) => media.set(handles[s], RENDITIONS.warm[s - 1]));
          series = { id: ID(next++), state: 'READY', handles };
          answer = { outcome: 'READY', seriesId: series.id };
        }
        answered.set(command, answer);
        return json(200, answer);
      }
      if (route === 'image-stages' && method === 'POST') {
        return replay(b.commandId, () => {
          if (!gateOpen) return { outcome: 'NOT_AVAILABLE_NOW' };
          if (series === null || series.id !== b.seriesId) return { outcome: 'UNAVAILABLE' };
          const stage = b.stage as Stage;
          series.state = 'DISCLOSING';
          const item: Image = { kind: 'IMAGE', mine: true, materialId: ID(next++), versionId: ID(next++), stage, handle: series.handles[stage], seriesId: series.id, at: at() };
          items.push(item);
          return { outcome: 'DISCLOSED', materialId: item.materialId, disclosedAt: item.at };
        });
      }
      if (route === 'image-removal' && method === 'POST') {
        return replay(b.commandId, () => {
          items = items.filter((i) => !(i.kind === 'IMAGE' && i.mine));
          series = null;
          return { outcome: 'REMOVED' };
        });
      }
      if (route.startsWith('media/') && method === 'GET') {
        const handle = route.slice(6);
        const visible = items.some((i) => i.kind === 'IMAGE' && i.handle === handle) || (series !== null && Object.values(series.handles).includes(handle));
        const bytes = media.get(handle);
        if (!visible || bytes === undefined) return json(404, { outcome: 'UNAVAILABLE' });
        return rendition(bytes);
      }
      if (route === 'display-name/grant' && method === 'POST') {
        return replay(b.commandId, () => {
          if (!gateOpen) return { outcome: 'NOT_AVAILABLE_NOW' };
          if (!items.some((i) => i.kind === 'TEXT' && i.mine && i.resourceType === 'FULL_NAME' && i.versionId === b.versionId)) return { outcome: 'NOT_SHARED' };
          displayed = String(b.versionId);
          return { outcome: 'GRANTED' };
        });
      }
      if (route === 'display-name/revoke' && method === 'POST') {
        return replay(b.commandId, () => {
          displayed = null;
          return { outcome: 'REVOKED' };
        });
      }
      if (route === 'success' && method === 'GET') {
        if (transition === 'COMPLETED') return json(200, { outcome: 'COMPLETED' });
        if (transition === 'NONE') return json(200, { outcome: 'NO_TRANSITION' });
        return json(200, { outcome: 'TRANSITION', versionId: ID(800), myState: myApproval, expectedEventId: approvalEvent });
      }
      if (route === 'success/approval' && method === 'POST') {
        return replay(b.commandId, () => {
          if (transition === 'COMPLETES') {
            transition = 'COMPLETED';
            return { outcome: 'COMPLETED' };
          }
          myApproval = 'APPROVED';
          approvalEvent = ID(next++);
          return { outcome: 'APPROVED', eventId: approvalEvent };
        });
      }
      if (route === 'success/withdrawal' && method === 'POST') {
        return replay(b.commandId, () => {
          myApproval = 'WITHDRAWN';
          approvalEvent = ID(next++);
          return { outcome: 'WITHDRAWN', eventId: approvalEvent };
        });
      }
      return json(400, { outcome: 'INVALID_REQUEST' });
    },
  };
}

/** The text route answers bare outcomes for everything but DISCLOSED, exactly as the service does. */
async function strip(answer: Answer): Promise<Answer> {
  const body = (await answer.json()) as Json;
  if (body.outcomeOnly === true) return { ok: true, status: 200, json: async () => ({ outcome: body.outcome }) };
  return { ok: answer.ok, status: answer.status, json: async () => body };
}
