/**
 * S5-02 — the Public authoring workspace inside the Public World root: the entry only after ALLOW, choosing EXISTING
 * material (never free text), the review of exactly what would become public, approval progress and the reader's own
 * approval / withdrawal, READY_FOR_REVIEW (never "published"), the explicit stale state, and the strict client.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { PublicWorldArea } from '../../public-world/PublicWorldArea';
import { createPublicWorldController } from '../../public-world/public-world-controller';
import type {
  PublicApprovalRequest, PublicAuthoringAnswer, PublicAuthoringDraft, PublicAuthoringReview, PublicAuthoringSources, PublicEntryResult,
} from '../../runtime-entry';
import { PublicAuthoringApiClient } from '../../runtime-entry';
import { PUBLIC_AUTHORING_COPY_GATE, publicAuthoringCopy } from '../copy';
import { createPublicAuthoringController, personalKey, sharedKey, type PublicAuthoringTransport } from '../public-authoring-controller';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const EXPERIENCE = id(2);
const MANIFEST = id(3);
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

const SOURCES: PublicAuthoringSources = {
  personal: [{ sourceId: id(10), text: 'what I told QANDEEL', at: 't' }],
  shared: [{ worldId: id(12), materialId: id(11), producer: 'HUMAN', isSelf: false, authorName: 'Hadir', text: 'what Hadir wrote', at: 't' }],
};
const reviewOf = (over: Partial<Extract<PublicAuthoringReview, { state: 'CURRENT' }>> = {}): PublicAuthoringReview => ({
  state: 'CURRENT', lifecycle: 'DRAFT', manifestId: MANIFEST, publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, itemCount: 2,
  requiredApprovals: 2, effectiveApprovals: 0, ownApproval: 'MISSING', readyAllowed: false,
  items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'what I told QANDEEL' }, { ordinal: 2, kind: 'SOURCE_CONTENT', text: 'what Hadir wrote' }],
  ...over,
});

function transport(over: Partial<Record<keyof PublicAuthoringTransport, jest.Mock>> = {}) {
  let review: PublicAuthoringReview = { state: 'NO_PACKAGE', lifecycle: 'DRAFT', publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' } };
  const drafts: PublicAuthoringDraft[] = [];
  const requests: PublicApprovalRequest[] = [];
  const t = {
    drafts: jest.fn(async () => yes<ReadonlyArray<PublicAuthoringDraft>>(drafts)),
    sources: jest.fn(async () => yes(SOURCES)),
    startDraft: jest.fn(async () => yes({ outcome: 'CREATED' as const, experienceId: EXPERIENCE })),
    preparePackage: jest.fn(async () => { review = reviewOf(); return yes('PREPARED' as const); }),
    review: jest.fn(async () => yes(review)),
    approvalRequests: jest.fn(async () => yes<ReadonlyArray<PublicApprovalRequest>>(requests)),
    approve: jest.fn(async () => { review = reviewOf({ effectiveApprovals: 1, ownApproval: 'EFFECTIVE' }); return yes('APPROVED' as const); }),
    withdraw: jest.fn(async () => { review = reviewOf({ effectiveApprovals: 0, ownApproval: 'WITHDRAWN' }); return yes('WITHDRAWN' as const); }),
    ready: jest.fn(async () => { review = reviewOf({ lifecycle: 'READY_FOR_REVIEW', effectiveApprovals: 2, ownApproval: 'EFFECTIVE' }); return yes('READY_FOR_REVIEW' as const); }),
    setReview: (next: PublicAuthoringReview) => { review = next; },
    drafts_: drafts,
    requests_: requests,
    ...over,
  };
  return t;
}

const appearance = () => {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({ reader: 'DARK' }),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  return authority;
};

async function mount(language: 'ar' | 'en', t: ReturnType<typeof transport>, entry: PublicEntryResult = { kind: 'ALLOW' }) {
  const authoring = createPublicAuthoringController({ transport: t as unknown as PublicAuthoringTransport, isCurrent: () => true, newCommandId: (() => { let n = 100; return () => id(n++); })() });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => entry) }, isCurrent: () => true, authoring });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  // The entry verdict and the typeface both settle before the root is drawn.
  for (let n = 0; n < 4; n += 1) await flush();
  return { view, authoring, controller };
}

afterEach(cleanup);

/** Every host component type in a rendered tree. */
function hostTypes(node: unknown): string[] {
  if (node === null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(hostTypes);
  const n = node as { type?: string; children?: unknown };
  return [n.type ?? '', ...hostTypes(n.children ?? null)];
}

describe('S5-02 the authoring entry lives inside the Public World root', () => {
  it('is drawn only after ALLOW, and a refusal shows none of it', async () => {
    const denied = await mount('en', transport(), { kind: 'DENIED' });
    expect(denied.view.queryByTestId('qandeel-public-authoring-entry')).toBeNull();
    await cleanup();
    const allowed = await mount('en', transport());
    expect(allowed.view.getByTestId('qandeel-public-authoring-entry').props.accessibilityLabel).toBe(publicAuthoringCopy('en').entry);
    expect(allowed.view.getByTestId('qandeel-public-field')).toBeTruthy();
  });
});

describe.each(['ar', 'en'] as const)('S5-02 %s journey: existing material → review → approval → READY_FOR_REVIEW', (language) => {
  const words = publicAuthoringCopy(language);

  it('starts a Draft and chooses only existing QANDEEL material — there is no text field', async () => {
    const t = transport();
    const { view } = await mount(language, t);
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-entry'));
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-workspace')).toBeTruthy();
    expect(view.getByTestId('qandeel-public-authoring-no-drafts').props.children).toBe(words.noDrafts);
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-start'));
    await flush();
    expect(t.startDraft).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('qandeel-public-authoring-choose')).toBeTruthy();
    expect(hostTypes(view.toJSON())).not.toContain('TextInput');
    const sources = view.getAllByTestId('qandeel-public-authoring-source');
    expect(sources).toHaveLength(2);
    expect(view.queryByTestId('qandeel-public-authoring-prepare')).toBeNull();
    await fireEvent.press(sources[0]);
    await fireEvent.press(sources[1]);
    expect(view.getAllByTestId('qandeel-public-authoring-source').map((s) => s.props.accessibilityState.checked)).toEqual([true, true]);
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-prepare'));
    await flush();
    expect(t.preparePackage).toHaveBeenCalledWith(EXPERIENCE, id(101), [id(10)], [{ worldId: id(12), materialId: id(11) }]);
    // The review: exactly what would become public, the CURRENT public display, the progress, nothing published.
    expect(view.getAllByTestId('qandeel-public-authoring-review-item')).toHaveLength(2);
    expect(view.getByTestId('qandeel-public-authoring-shown-as').props.children).toBe('nightlamp27');
    expect(view.getByTestId('qandeel-public-authoring-draft').props.children).toBe(words.draftState);
    expect(view.getByTestId('qandeel-public-authoring-progress').props.children).toBe(words.approvals.replace('{0}', '0').replace('{1}', '2'));
    expect(view.queryByTestId('qandeel-public-authoring-mark-ready')).toBeNull();
  });

  it('approves the reader\'s own words, withdraws immediately, and reaches READY_FOR_REVIEW — never "published"', async () => {
    const t = transport();
    t.setReview(reviewOf());
    const { view, authoring } = await mount(language, t);
    await act(async () => { authoring.openDraft(EXPERIENCE); });
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-own-approve'));
    await flush();
    expect(t.approve).toHaveBeenCalledWith(MANIFEST, expect.any(String));
    expect(view.getByTestId('qandeel-public-authoring-own-approved').props.children).toBe(words.approved);
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-own-withdraw'));
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-own-withdrawn').props.children).toBe(words.withdrawn);
    expect(view.queryByTestId('qandeel-public-authoring-own-approve')).toBeNull();
    // The server says every current approval is effective: only then is "ready for review" offered.
    t.setReview(reviewOf({ effectiveApprovals: 2, ownApproval: 'EFFECTIVE', readyAllowed: true }));
    await act(async () => { authoring.refresh(); });
    await flush();
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-mark-ready'));
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-ready').props.children).toBe(words.readyState);
    const everything = JSON.stringify(view.toJSON());
    expect(everything).not.toMatch(/Published|نُشرت|منشورة/u);
    expect(everything).toContain(language === 'ar' ? 'لم تُنشر' : 'Not published');
  });

  it('a package that is no longer whole is one explicit stale line and nothing of it', async () => {
    const t = transport();
    t.setReview({ state: 'UNAVAILABLE', lifecycle: 'DRAFT', publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' } });
    const { view, authoring } = await mount(language, t);
    await act(async () => { authoring.openDraft(EXPERIENCE); });
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-review-unavailable').props.children).toBe(words.noLongerAvailable);
    expect(view.queryAllByTestId('qandeel-public-authoring-review-item')).toHaveLength(0);
    expect(view.queryByTestId('qandeel-public-authoring-mark-ready')).toBeNull();
  });
});

describe('S5-02 the approver sees only their own included words', () => {
  it('lists a request with the publisher\'s public display, their own words, and approve', async () => {
    const t = transport();
    t.requests_.push({ manifestId: MANIFEST, state: 'CURRENT', lifecycle: 'DRAFT', publisher: { mode: 'REAL_NAME', label: 'Mohamed' },
      itemCount: 3, ownItemCount: 1, requiredApprovals: 2, effectiveApprovals: 1, ownApproval: 'MISSING', ownItems: [{ ordinal: 2, text: 'what Hadir wrote' }] });
    t.requests_.push({ manifestId: id(4), state: 'UNAVAILABLE', lifecycle: 'DRAFT', publisher: { mode: 'REAL_NAME', label: 'Mohamed' },
      itemCount: null, ownItemCount: null, requiredApprovals: null, effectiveApprovals: null, ownApproval: null, ownItems: [] });
    const { view } = await mount('en', t);
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-entry'));
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-requests')).toBeTruthy();
    expect(view.getAllByTestId('qandeel-public-authoring-request-word').map((w) => w.props.children)).toEqual(['what Hadir wrote']);
    expect(view.getAllByText('Requested by Mohamed')).toHaveLength(2);
    expect(view.getByTestId('qandeel-public-authoring-request-unavailable')).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-authoring-request-approve'));
    await flush();
    expect(t.approve).toHaveBeenCalledWith(MANIFEST, expect.any(String));
  });
});

describe('S5-02 the controller never decides', () => {
  it('a lost answer is a neutral notice and the SAME command on retry', async () => {
    const t = transport({ startDraft: jest.fn(async () => ({ kind: 'NO_ANSWER' as const })) });
    const authoring = createPublicAuthoringController({ transport: t as unknown as PublicAuthoringTransport, isCurrent: () => true });
    authoring.open();
    await flush();
    authoring.startDraft();
    await flush();
    expect(authoring.getState().notice).toBe('ACTION_UNAVAILABLE');
    authoring.startDraft();
    await flush();
    expect(t.startDraft.mock.calls[0][0]).toBe(t.startDraft.mock.calls[1][0]);
  });

  it('bounds a package at 20 sources and keys them exactly', async () => {
    const many = { personal: Array.from({ length: 25 }, (_, n) => ({ sourceId: id(200 + n), text: `w${n}`, at: 't' })), shared: [] };
    const t = transport({ sources: jest.fn(async () => yes(many)) });
    const authoring = createPublicAuthoringController({ transport: t as unknown as PublicAuthoringTransport, isCurrent: () => true });
    authoring.startDraft();
    await flush();
    for (const s of many.personal) authoring.toggle(personalKey(s.sourceId));
    expect(authoring.getState().selected).toHaveLength(20);
    expect(sharedKey(id(1), id(2))).toBe(`S:${id(1)}:${id(2)}`);
  });

  it('with no transport, nothing is offered as possible', async () => {
    const authoring = createPublicAuthoringController({ transport: null, isCurrent: () => true });
    authoring.open();
    await flush();
    expect(authoring.getState().status).toBe('UNAVAILABLE');
  });
});

describe('S5-02 client decoding', () => {
  const client = (body: unknown, ok = true) => new PublicAuthoringApiClient({
    baseUrl: 'https://api.test',
    fetch: jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as never,
  });

  it('a partial or malformed review is no answer', async () => {
    const partial = { state: 'CURRENT', lifecycle: 'DRAFT', manifestId: MANIFEST, publisher: { mode: 'PSEUDONYM', label: 'x' }, itemCount: 2,
      requiredApprovals: 1, effectiveApprovals: 0, ownApproval: 'MISSING', readyAllowed: false, items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'a' }] };
    expect(await client(partial).review(EXPERIENCE)).toEqual({ kind: 'NO_ANSWER' });
    expect(await client({ ...partial, itemCount: 1 }).review(EXPERIENCE)).toMatchObject({ kind: 'ANSWER', value: { state: 'CURRENT' } });
    expect(await client({ ...partial, itemCount: 1, state: 'PUBLISHED' }).review(EXPERIENCE)).toEqual({ kind: 'NO_ANSWER' });
    expect(await client(partial, false).review(EXPERIENCE)).toEqual({ kind: 'NO_ANSWER' });
  });

  it('sends only command ids and selected sources', async () => {
    const fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ outcome: 'PREPARED' }) }));
    const api = new PublicAuthoringApiClient({ baseUrl: 'https://api.test', fetch: fetch as never });
    expect(await api.preparePackage(EXPERIENCE, id(1), [id(10)], [{ worldId: id(12), materialId: id(11) }])).toEqual({ kind: 'ANSWER', value: 'PREPARED' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ commandId: id(1), personal: [id(10)], shared: [{ worldId: id(12), materialId: id(11) }] });
  });
});

describe('S5-02 Product Copy Gate', () => {
  it('names every new row PROPOSED and reuses frozen words byte-exact', () => {
    expect(PUBLIC_AUTHORING_COPY_GATE.status).toMatch(/OPEN/u);
    expect(PUBLIC_AUTHORING_COPY_GATE.approved).toEqual([]);
    expect(PUBLIC_AUTHORING_COPY_GATE.proposed.length).toBeGreaterThan(0);
    expect(publicAuthoringCopy('ar').back).toBe('رجوع');
    expect(publicAuthoringCopy('ar').shownAs).toBe('الظهور في العالم العام');
    expect(publicAuthoringCopy('en').qandeel).toBe('QANDEEL');
    for (const language of ['ar', 'en'] as const) {
      const words = publicAuthoringCopy(language);
      for (const row of PUBLIC_AUTHORING_COPY_GATE.proposed) expect(typeof words[row]).toBe('string');
    }
  });
});
