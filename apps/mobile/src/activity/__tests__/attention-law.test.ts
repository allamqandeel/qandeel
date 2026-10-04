/**
 * A3-01 — the attention law on the device (P3 §7–§9, §15) and the strict Activity wire (I-08N-01 D45).
 */
import { ActivityApiClient, createManualForegroundSignal } from '../../runtime-entry';
import { createActivityAttentionController, type AttentionTransport } from '../attention-controller';
import { PRODUCTION_CALL_TRUTH } from '../call-truth';
import { decidePresentation, type PresentationContext } from '../presentation';
import { PREFERENCES, candidate, item, snapshot } from '../__fixtures__/activity';

const CONVERSATION: PresentationContext = { foreground: true, surface: 'CONVERSATION', call: PRODUCTION_CALL_TRUTH, showing: false };

describe('the presentation law', () => {
  it('foreground, non-Analysis, outside the origin: ONE ordinary strip; the rest settled — never a dump', () => {
    const a = candidate({}, { interruptionClass: 3 });
    const b = candidate({}, { interruptionClass: 2 });
    const c = candidate({}, { interruptionClass: 3 });
    const decision = decidePresentation([a, b, c], CONVERSATION);
    expect(decision.kind).toBe('PRESENT');
    if (decision.kind !== 'PRESENT') return;
    expect(decision.form).toBe('ORDINARY');
    expect(decision.presented).toBe(b);
    expect(decision.settled).toEqual(expect.arrayContaining([a, c]));
    expect(decision.settled).toHaveLength(2);
  });

  it('inside the Analysis ordinary attention WAITS — critical security outside a call included; nothing settled', () => {
    const security = candidate({}, { interruptionClass: 1, callSafe: true });
    expect(decidePresentation([candidate(), security], { ...CONVERSATION, surface: 'ANALYSIS' })).toEqual({ kind: 'WAIT' });
  });

  it('in the originating context the event is there in place: no strip (D51)', () => {
    const personal = candidate({ category: 'QANDEEL', speaker: 'QANDEEL' }, { contextKind: 'PERSONAL' });
    expect(decidePresentation([personal], CONVERSATION)).toEqual({ kind: 'SETTLE', settled: [personal] });
    // …but the same event strips over General Settings, a different non-Analysis surface.
    expect(decidePresentation([personal], { ...CONVERSATION, surface: 'SETTINGS' }).kind).toBe('PRESENT');
  });

  it('Activity represents every item in place', () => {
    const one = candidate();
    expect(decidePresentation([one], { ...CONVERSATION, surface: 'ACTIVITY' })).toEqual({ kind: 'SETTLE', settled: [one] });
  });

  it('in the background, or while a strip shows, nothing is presented and nothing settled', () => {
    expect(decidePresentation([candidate()], { ...CONVERSATION, foreground: false })).toEqual({ kind: 'WAIT' });
    expect(decidePresentation([candidate()], { ...CONVERSATION, showing: true })).toEqual({ kind: 'WAIT' });
  });

  it('during a Live Call (fixture call truth — none exists in production): only the two call-safe exceptions, dismiss-only form', () => {
    const ordinary = candidate();
    const safe = candidate({}, { interruptionClass: 1, callSafe: true });
    const call = { ...CONVERSATION, call: { kind: 'ACTIVE' as const } };
    expect(decidePresentation([ordinary], call)).toEqual({ kind: 'WAIT' });
    expect(decidePresentation([ordinary, safe], call)).toEqual({ kind: 'PRESENT', form: 'CALL_SAFE', presented: safe, settled: [] });
    expect(decidePresentation([ordinary, safe], { ...call, surface: 'ANALYSIS' })).toMatchObject({ form: 'CALL_SAFE', presented: safe });
    expect(PRODUCTION_CALL_TRUTH).toEqual({ kind: 'NO_CALL_KNOWN' });
  });
});

describe('the attention controller — Analysis deferral and exit re-evaluation', () => {
  function rig(reads: (() => ReturnType<AttentionTransport['readAttention']>)[]) {
    const foreground = createManualForegroundSignal('ACTIVE');
    const recorded: { presented: string | null; settled: readonly string[] }[] = [];
    const zones: string[] = [];
    let call = 0;
    const transport: AttentionTransport = {
      readAttention: (zone) => {
        zones.push(zone);
        return reads[Math.min(call++, reads.length - 1)]();
      },
      recordStrip: async (presented, settled) => {
        recorded.push({ presented, settled });
        return true;
      },
    };
    const timers: (() => void)[] = [];
    const controller = createActivityAttentionController({
      transport, foreground, isCurrent: () => true, timeZone: () => 'Africa/Cairo',
      setTimer: (callback) => timers.push(callback), clearTimer: () => undefined,
    });
    return { controller, foreground, recorded, zones, timers, reads: () => call };
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('reads only in the foreground, in the device zone, and polls on its own cadence while foreground', async () => {
    const r = rig([async () => ({ kind: 'READ', snapshot: snapshot() })]);
    r.foreground.set('INACTIVE');
    r.controller.start();
    await flush();
    expect(r.reads()).toBe(0);
    r.foreground.set('ACTIVE');
    await flush();
    expect(r.reads()).toBe(1);
    expect(r.zones).toEqual(['Africa/Cairo']);
    expect(r.timers).toHaveLength(1);
    r.timers[0]();
    await flush();
    expect(r.reads()).toBe(2);
    r.controller.retire();
  });

  it('presence only: no global count reaches the state', async () => {
    const r = rig([async () => ({ kind: 'READ', snapshot: snapshot([], true) })]);
    r.controller.start();
    await flush();
    expect(r.controller.getState().present).toBe(true);
    expect(Object.keys(r.controller.getState()).sort()).toEqual(['categories', 'present', 'strip']);
    r.controller.retire();
  });

  it('inside the Analysis: no strip, nothing recorded; leaving re-reads CURRENT truth and presents at most one', async () => {
    const a = candidate({}, { interruptionClass: 3 });
    const b = candidate({}, { interruptionClass: 2 });
    const stale = candidate();
    const r = rig([
      async () => ({ kind: 'READ', snapshot: snapshot() }),
      async () => ({ kind: 'READ', snapshot: snapshot([a, b, stale]) }),
      // On leaving: current truth no longer lists the item that went stale meanwhile.
      async () => ({ kind: 'READ', snapshot: snapshot([a, b]) }),
    ]);
    r.controller.start();
    await flush();
    r.controller.setSurface('ANALYSIS');
    r.controller.refresh();
    await flush();
    expect(r.controller.getState().strip).toBeNull();
    expect(r.recorded).toEqual([]);
    r.controller.setSurface('CONVERSATION');
    await flush();
    expect(r.reads()).toBe(3);
    expect(r.controller.getState().strip?.candidate).toBe(b);
    expect(r.recorded).toEqual([{ presented: b.item.id, settled: [a.item.id] }]);
    // The settled one never strips later; the stale one was never shown merely because it waited.
    r.controller.dismissStrip();
    r.controller.refresh();
    await flush();
    expect(r.controller.getState().strip).toBeNull();
    r.controller.retire();
  });

  it('a strip showing when the reader enters the Analysis leaves with them', async () => {
    const one = candidate();
    const r = rig([async () => ({ kind: 'READ', snapshot: snapshot([one]) })]);
    r.controller.start();
    await flush();
    expect(r.controller.getState().strip?.candidate).toBe(one);
    r.controller.setSurface('ANALYSIS');
    expect(r.controller.getState().strip).toBeNull();
    r.controller.retire();
  });

  it('takeStrip hands the item to the caller for revalidated Direct Entry; the strip is gone', async () => {
    const one = candidate();
    const r = rig([async () => ({ kind: 'READ', snapshot: snapshot([one]) })]);
    r.controller.start();
    await flush();
    expect(r.controller.takeStrip()).toBe(one);
    expect(r.controller.getState().strip).toBeNull();
    r.controller.retire();
  });
});

describe('the Activity wire is decoded strictly (through the public client)', () => {
  const client = (body: unknown) => new ActivityApiClient({
    baseUrl: 'https://api.test',
    fetch: async () => ({ ok: true, status: 200, json: async () => body }),
  });
  const page = (items: unknown[]) => client({ items, before: null }).readPage({ category: null, before: null, limit: 30 });

  it('an item: exact keys; QANDEEL voice only in QANDEEL; unknown categories refused', async () => {
    expect((await page([item()])).kind).toBe('READ');
    expect((await page([{ ...item(), score: 3 }])).kind).toBe('UNAVAILABLE');
    expect((await page([{ ...item(), category: 'WORLD' }])).kind).toBe('UNAVAILABLE');
    expect((await page([{ ...item({ category: 'SHARED' }), speaker: 'QANDEEL' }])).kind).toBe('UNAVAILABLE');
  });

  it('the global indicator is presence ONLY: an answer carrying a global count is not an answer (D45)', async () => {
    const body = { ...snapshot([], true) };
    expect((await client(body).readAttention('UTC')).kind).toBe('READ');
    expect((await client({ ...body, count: 3 }).readAttention('UTC')).kind).toBe('UNAVAILABLE');
    expect((await client({ ...body, categories: { ...body.categories, INTRODUCTIONS: { present: true, count: 2 } } }).readAttention('UTC')).kind).toBe('UNAVAILABLE');
  });

  it('preferences: the frozen vocabulary only', async () => {
    expect(await client(PREFERENCES).readPreferences()).toEqual({ kind: 'READ', preferences: PREFERENCES });
    expect((await client({ ...PREFERENCES, proactive: 'SOMETIMES' }).readPreferences()).kind).toBe('UNAVAILABLE');
    expect((await client({ ...PREFERENCES, lockScreen: { ...PREFERENCES.lockScreen, SECURITY: 'L4' } }).readPreferences()).kind).toBe('UNAVAILABLE');
    expect((await client({ ...PREFERENCES, criticalSecurity: false }).readPreferences()).kind).toBe('UNAVAILABLE');
  });
});
