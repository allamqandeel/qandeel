/**
 * S8A-05 CP1 R2 — the draft saves itself (WP1: autosave). Typing that rests is saved once; a save already out is never
 * raced (the next one waits for it and saves the newest words at the confirmed revision, never STALE against itself);
 * closing the workspace, retiring the Public area or leaving the foreground saves what is unsaved at once; and the draft
 * counts as saved ONLY while the account holds exactly the words shown — a failed save never says it was saved.
 */
import type { PublicAuthoringAnswer, PublicTopicSaveResult, PublicTopicSection } from '../../runtime-entry';
import { createManualForegroundSignal } from '../../runtime-entry';
import {
  PUBLIC_COMPOSE_AUTOSAVE_MS, createPublicComposeController, isDraftSaved, type PublicComposeController, type PublicComposeTransport,
} from '../public-compose-controller';

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const ids = () => { let n = 100; return () => id(n++); };
/** Lets every settled promise run, under fake timers. */
const drain = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

interface Held { readonly words: [string, number, string, string, PublicTopicSection | null]; readonly answer: (a: PublicAuthoringAnswer<PublicTopicSaveResult>) => void }

/** One account. Saves answer at once unless `hold` is set; then each waits in `held` for the test to answer it. */
function account() {
  let revision = 0;
  const stored: { title: string; text: string } = { title: '', text: '' };
  const held: Held[] = [];
  const ctl = { hold: false, fail: false };
  const commit = (expected: number, title: string, text: string): PublicTopicSaveResult => {
    if (expected !== revision) return { outcome: 'STALE', revision };
    revision += 1;
    Object.assign(stored, { title, text });
    return { outcome: revision === 1 ? 'CREATED' : 'SAVED', revision };
  };
  const save = jest.fn((draftId: string, expected: number, title: string, text: string, section: PublicTopicSection | null) => {
    if (ctl.fail) return Promise.resolve<PublicAuthoringAnswer<PublicTopicSaveResult>>({ kind: 'NO_ANSWER' });
    if (!ctl.hold) return Promise.resolve(yes(commit(expected, title, text)));
    return new Promise<PublicAuthoringAnswer<PublicTopicSaveResult>>((resolve) => {
      held.push({ words: [draftId, expected, title, text, section], answer: resolve });
    });
  });
  const release = (n = 0) => {
    const h = held.splice(n, 1)[0];
    h.answer(yes(commit(h.words[1], h.words[2], h.words[3])));
  };
  const transport = {
    drafts: jest.fn(async () => yes([])), draft: jest.fn(), save, remove: jest.fn(), preview: jest.fn(), prepare: jest.fn(), discard: jest.fn(),
  } as unknown as PublicComposeTransport;
  return { transport, save, held, release, ctl, stored, revision: () => revision };
}

async function editing(t: ReturnType<typeof account>, foreground = createManualForegroundSignal()) {
  const c: PublicComposeController = createPublicComposeController({ transport: t.transport, isCurrent: () => true, newId: ids(), foreground });
  c.open();
  await drain();
  c.newDraft();
  return { c, foreground };
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('S8A-05 CP1 R2 — the draft saves itself', () => {
  it('saves once when typing rests, and only then counts as saved', async () => {
    const t = account();
    const { c } = await editing(t);
    c.setTitle('كيف أبدأ');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS - 1);
    c.setTitle('كيف أبدأ من جديد');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS - 1);
    expect(t.save).not.toHaveBeenCalled();
    expect(isDraftSaved(c.getState())).toBe(false);
    jest.advanceTimersByTime(1);
    await drain();
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.save).toHaveBeenCalledWith(id(100), 0, 'كيف أبدأ من جديد', '', null);
    expect(c.getState().saving).toBe('IDLE');
    expect(isDraftSaved(c.getState())).toBe(true);
    // A new word makes it unsaved again at once, before any save.
    c.setText('نص');
    expect(isDraftSaved(c.getState())).toBe(false);
  });

  it('is SAVING while the save is out, and never saved when it fails; the words stay', async () => {
    const t = account();
    const { c } = await editing(t);
    t.ctl.hold = true;
    c.setTitle('عنوان المسودة');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS);
    await drain();
    expect(c.getState().saving).toBe('SAVING');
    expect(isDraftSaved(c.getState())).toBe(false);
    t.release();
    await drain();
    expect(isDraftSaved(c.getState())).toBe(true);
    t.ctl.hold = false;
    t.ctl.fail = true;
    c.setText('ما كُتب');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS);
    await drain();
    expect(c.getState().saving).toBe('FAILED');
    expect(isDraftSaved(c.getState())).toBe(false);
    expect(c.getState().draft).toMatchObject({ text: 'ما كُتب', dirty: true });
    // Saving again (the way to try again) succeeds once the account answers.
    t.ctl.fail = false;
    c.save();
    await drain();
    expect(isDraftSaved(c.getState())).toBe(true);
    expect(t.stored.text).toBe('ما كُتب');
  });

  it('typing during a save is saved next, at the revision the account confirmed — never STALE against itself', async () => {
    const t = account();
    const { c } = await editing(t);
    t.ctl.hold = true;
    c.setTitle('العنوان الأول');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS);
    await drain();
    expect(t.held).toHaveLength(1);
    c.setTitle('العنوان الأول ثم الثاني');
    c.save();
    await drain();
    // The second save waits for the first: one out at a time.
    expect(t.held).toHaveLength(1);
    t.release();
    await drain();
    expect(isDraftSaved(c.getState())).toBe(false);
    expect(t.held).toHaveLength(1);
    expect(t.held[0].words.slice(1, 3)).toEqual([1, 'العنوان الأول ثم الثاني']);
    t.release();
    await drain();
    expect(t.revision()).toBe(2);
    expect(t.stored.title).toBe('العنوان الأول ثم الثاني');
    expect(isDraftSaved(c.getState())).toBe(true);
    expect(c.getState().notice).toBe('NONE');
  });

  it('closing the workspace saves unsaved words at once', async () => {
    const t = account();
    const { c } = await editing(t);
    c.setText('كلمات لم تُحفظ بعد');
    c.close();
    await drain();
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.stored.text).toBe('كلمات لم تُحفظ بعد');
    jest.advanceTimersByTime(PUBLIC_COMPOSE_AUTOSAVE_MS * 2);
    await drain();
    expect(t.save).toHaveBeenCalledTimes(1);
  });

  it('retiring the Public area saves unsaved words at once', async () => {
    const t = account();
    const { c } = await editing(t);
    c.setTitle('عنوان قبل الخروج');
    c.retire();
    await drain();
    expect(t.stored.title).toBe('عنوان قبل الخروج');
  });

  it('leaving the foreground saves unsaved words at once; nothing to save, nothing is sent', async () => {
    const t = account();
    const { c, foreground } = await editing(t);
    foreground.set('INACTIVE');
    await drain();
    expect(t.save).not.toHaveBeenCalled();
    foreground.set('ACTIVE');
    c.setText('قبل أن يغادر التطبيق');
    foreground.set('INACTIVE');
    await drain();
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.stored.text).toBe('قبل أن يغادر التطبيق');
    expect(isDraftSaved(c.getState())).toBe(true);
  });
});
