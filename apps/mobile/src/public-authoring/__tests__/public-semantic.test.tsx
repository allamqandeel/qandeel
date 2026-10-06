/**
 * S5-03A — the semantic review stage of the Public authoring workspace: drawn only for READY_FOR_REVIEW, QANDEEL's
 * proposed understanding (meaning, main and other meanings, why), accept exactly the revision seen, correct the MEANING
 * in one's own words (never a place), the notices, the strict client, and the S5-03A Product Copy Gate census.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import { PublicWorldArea } from '../../public-world/PublicWorldArea';
import { createPublicWorldController } from '../../public-world/public-world-controller';
import type { PublicAuthoringAnswer, PublicAuthoringReview, PublicSemanticReview } from '../../runtime-entry';
import { PublicWorldApiClient } from '../../runtime-entry';
import {
  createPublicAuthoringController, semanticCorrectionOf, type PublicAuthoringTransport, type PublicSemanticTransport,
} from '../public-authoring-controller';
import { publicAuthoringCopy } from '../copy';
import { PUBLIC_SEMANTIC_COPY_GATE, publicSemanticCopy } from '../semantic-copy';

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const INSETS = { top: 44, right: 0, bottom: 0, left: 0 };
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const EXPERIENCE = id(2);
const MANIFEST = id(3);
const INTERPRETATION = id(4);
const yes = <T,>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });

const readyReview = (lifecycle: 'DRAFT' | 'READY_FOR_REVIEW' = 'READY_FOR_REVIEW'): PublicAuthoringReview => ({
  state: 'CURRENT', lifecycle, manifestId: MANIFEST, publisher: { mode: 'PSEUDONYM', label: 'nightlamp27' }, itemCount: 1,
  requiredApprovals: 1, effectiveApprovals: 1, ownApproval: 'EFFECTIVE', readyAllowed: false,
  items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'what I told QANDEEL' }],
});
const proposed = (over: Partial<Extract<PublicSemanticReview, { interpretationId: string }>> = {}): PublicSemanticReview => ({
  state: 'AWAITING_REVIEW', interpretationId: INTERPRETATION, revision: 1, origin: 'QANDEEL', meaning: 'Fear for a family while work feels uncertain',
  primaryThemes: ['fear', 'family'], secondaryThemes: ['work'], explanation: 'The words keep returning to the people who depend on the speaker.',
  decision: null, ready: false, ...over,
});

function transports(review: PublicAuthoringReview = readyReview()) {
  let understanding: PublicSemanticReview = { state: 'NO_PROPOSAL', ready: false };
  const authoring = {
    drafts: jest.fn(async () => yes([])), sources: jest.fn(async () => yes({ personal: [], shared: [] })),
    startDraft: jest.fn(), preparePackage: jest.fn(), review: jest.fn(async () => yes(review)),
    approvalRequests: jest.fn(async () => yes([])), approve: jest.fn(), withdraw: jest.fn(), ready: jest.fn(),
  };
  const semantic = {
    semanticReview: jest.fn(async () => yes(understanding)),
    proposeSemantic: jest.fn(async () => { understanding = proposed(); return yes('PROPOSED' as const); }),
    acceptSemantic: jest.fn(async () => { understanding = proposed({ state: 'REVIEWED', decision: 'ACCEPTED', ready: true }); return yes('ACCEPTED' as const); }),
    correctSemantic: jest.fn(async (_e: string, _c: string, _i: string, correction: { meaning: string; primaryThemes: string[]; secondaryThemes: string[] }) => {
      understanding = proposed({ state: 'REVIEWED', interpretationId: id(5), revision: 2, origin: 'PUBLISHER', meaning: correction.meaning,
        primaryThemes: correction.primaryThemes, secondaryThemes: correction.secondaryThemes, explanation: null, decision: 'CORRECTED', ready: true });
      return yes('CORRECTED' as const);
    }),
    set: (next: PublicSemanticReview) => { understanding = next; },
  };
  return { authoring, semantic };
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

async function mount(language: 'ar' | 'en', t: ReturnType<typeof transports>) {
  const authoring = createPublicAuthoringController({
    transport: t.authoring as unknown as PublicAuthoringTransport, semantic: t.semantic as unknown as PublicSemanticTransport,
    isCurrent: () => true, newCommandId: (() => { let n = 100; return () => id(n++); })(),
  });
  const controller = createPublicWorldController({ transport: { entry: jest.fn(async () => ({ kind: 'ALLOW' as const })) }, isCurrent: () => true, authoring });
  const view = await render(<AppearanceProvider authority={appearance()}><PublicWorldArea controller={controller} language={language} insets={INSETS} /></AppearanceProvider>);
  for (let n = 0; n < 4; n += 1) await flush();
  await act(async () => { authoring.openDraft(EXPERIENCE); });
  await flush();
  return { view, authoring };
}

afterEach(cleanup);

/** Every host component type in a rendered tree. */
function hostTypes(node: unknown): string[] {
  if (node === null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(hostTypes);
  const n = node as { type?: string; children?: unknown };
  return [n.type ?? '', ...hostTypes(n.children ?? null)];
}

describe('S5-03A the semantic stage exists only once the Experience is READY_FOR_REVIEW', () => {
  it('draws nothing of it for a Draft, and asks nothing', async () => {
    const t = transports(readyReview('DRAFT'));
    const { view } = await mount('en', t);
    expect(view.getByTestId('qandeel-public-authoring-review-current')).toBeTruthy();
    expect(view.queryByTestId('qandeel-public-semantic')).toBeNull();
    expect(t.semantic.semanticReview).not.toHaveBeenCalled();
  });

  it('a lost semantic answer is one neutral line, and offers nothing', async () => {
    const t = transports();
    t.semantic.semanticReview.mockImplementation(async () => ({ kind: 'NO_ANSWER' as const }));
    const { view } = await mount('en', t);
    expect(view.getByTestId('qandeel-public-semantic-unavailable').props.children).toBe(publicSemanticCopy('en').actionUnavailable);
    expect(view.queryByTestId('qandeel-public-semantic-ask')).toBeNull();
    expect(view.queryByTestId('qandeel-public-semantic-accept')).toBeNull();
  });
});

describe.each(['ar', 'en'] as const)('S5-03A %s journey: ask → QANDEEL\'s understanding → accept, or correct the meaning', (language) => {
  const words = publicSemanticCopy(language);
  const separator = language === 'ar' ? '، ' : ', ';

  it('asks, shows the meaning, main and other meanings and why, then accepts exactly the revision seen', async () => {
    const t = transports();
    const { view } = await mount(language, t);
    expect(view.getByTestId('qandeel-public-semantic-heading').props.children).toBe(words.heading);
    expect(view.getByText(words.explain)).toBeTruthy();
    await fireEvent.press(view.getByTestId('qandeel-public-semantic-ask'));
    await flush();
    expect(t.semantic.proposeSemantic).toHaveBeenCalledWith(EXPERIENCE, id(100));
    expect(view.getByTestId('qandeel-public-semantic-awaiting')).toBeTruthy();
    expect(view.getByTestId('qandeel-public-semantic-meaning').props.children).toBe('Fear for a family while work feels uncertain');
    expect(view.getByTestId('qandeel-public-semantic-primary').props.children).toBe(['fear', 'family'].join(separator));
    expect(view.getByTestId('qandeel-public-semantic-secondary').props.children).toBe('work');
    expect(view.getByTestId('qandeel-public-semantic-why').props.children).toContain('people who depend');
    await fireEvent.press(view.getByTestId('qandeel-public-semantic-accept'));
    await flush();
    expect(t.semantic.acceptSemantic).toHaveBeenCalledWith(EXPERIENCE, expect.any(String), INTERPRETATION);
    expect(view.getByTestId('qandeel-public-semantic-accepted').props.children).toBe(words.acceptedState);
    expect(view.queryByTestId('qandeel-public-semantic-accept')).toBeNull();
    // Still not published; no place, coordinate, model or lens anywhere.
    const everything = JSON.stringify(view.toJSON());
    expect(everything).toContain(language === 'ar' ? 'لم تُنشر' : 'Not published');
    expect(everything).not.toMatch(/Published|نُشرت|منشورة/u);
    expect(everything).not.toMatch(/coordinate|lens|vector|embedding|placement|model|إحداثي/iu);
  });

  it('corrects the meaning in the reader\'s own words, starting from what QANDEEL proposed', async () => {
    const t = transports();
    t.semantic.set(proposed());
    const { view } = await mount(language, t);
    expect(hostTypes(view.toJSON())).not.toContain('TextInput');
    await fireEvent.press(view.getByTestId('qandeel-public-semantic-correct'));
    await flush();
    expect(view.getByText(words.correctionScope)).toBeTruthy();
    expect(view.getByTestId('qandeel-public-semantic-meaning-field').props.value).toBe('Fear for a family while work feels uncertain');
    expect(view.getByTestId('qandeel-public-semantic-primary-field').props.value).toBe(['fear', 'family'].join(separator));
    await fireEvent.changeText(view.getByTestId('qandeel-public-semantic-meaning-field'), '  A parent   afraid of losing work ');
    await fireEvent.changeText(view.getByTestId('qandeel-public-semantic-primary-field'), 'parenthood، fear');
    await fireEvent.changeText(view.getByTestId('qandeel-public-semantic-secondary-field'), 'work,');
    await fireEvent.press(view.getByTestId('qandeel-public-semantic-submit'));
    await flush();
    expect(t.semantic.correctSemantic).toHaveBeenCalledWith(EXPERIENCE, expect.any(String), INTERPRETATION,
      { meaning: 'A parent afraid of losing work', primaryThemes: ['parenthood', 'fear'], secondaryThemes: ['work'] });
    expect(view.getByTestId('qandeel-public-semantic-corrected').props.children).toBe(words.correctedState);
    expect(view.getByTestId('qandeel-public-semantic-meaning').props.children).toBe('A parent afraid of losing work');
    expect(view.queryByTestId('qandeel-public-semantic-correction')).toBeNull();
    expect(view.queryByTestId('qandeel-public-semantic-why')).toBeNull();
  });
});

describe('S5-03A the correction is checked, and the controller never decides', () => {
  it('refuses words that cannot be a correction locally, sending nothing', async () => {
    const t = transports();
    t.semantic.set(proposed());
    const { view, authoring } = await mount('en', t);
    await act(async () => { authoring.openCorrection(); });
    await flush();
    for (const [meaning, primary, secondary] of [['', 'fear', ''], ['x'.repeat(121), 'fear', ''], ['ok', '', ''], ['ok', 'a,b,c,d', ''],
      ['ok', 'fear', 'fear'], ['ok', 't'.repeat(41), ''], [`next to ${id(9)}`, 'fear', '']]) {
      await act(async () => { authoring.submitCorrection(meaning, primary, secondary); });
      expect(authoring.getState().notice).toBe('CORRECTION_INVALID');
    }
    expect(t.semantic.correctSemantic).not.toHaveBeenCalled();
    await flush();
    expect(view.getByTestId('qandeel-public-authoring-notice').props.children).toBe(publicSemanticCopy('en').correctionInvalid);
  });

  it('keeps the form and the reader\'s words when QANDEEL finds the correction unsupported or unchanged', async () => {
    for (const [outcome, notice] of [['NOT_SUPPORTED', 'notSupported'], ['UNCHANGED', 'unchanged'],
      ['LIMITED', 'limited'], ['INTERPRETATION_UNAVAILABLE', 'interpretationUnavailable']] as const) {
      const t = transports();
      t.semantic.set(proposed());
      t.semantic.correctSemantic.mockImplementation(async () => yes(outcome) as never);
      const { view, authoring } = await mount('en', t);
      await act(async () => { authoring.openCorrection(); });
      await flush();
      await act(async () => { authoring.submitCorrection('A story about sailing', 'sailing', ''); });
      await flush();
      expect(authoring.getState().correcting).toBe(true);
      expect(view.getByTestId('qandeel-public-authoring-notice').props.children).toBe(publicSemanticCopy('en')[notice]);
      await cleanup();
    }
  });

  it('an interpretation QANDEEL could not produce is retried with the SAME command', async () => {
    const t = transports();
    t.semantic.proposeSemantic.mockImplementation(async () => yes('INTERPRETATION_UNAVAILABLE' as const) as never);
    const { authoring } = await mount('en', t);
    await act(async () => { authoring.requestUnderstanding(); });
    await flush();
    expect(authoring.getState().notice).toBe('INTERPRETATION_UNAVAILABLE');
    await act(async () => { authoring.requestUnderstanding(); });
    await flush();
    const calls = t.semantic.proposeSemantic.mock.calls as unknown as Array<[string, string]>;
    expect(calls[0][1]).toBe(calls[1][1]);
  });

  it('a stale correction closes the form and asks the server again', async () => {
    const t = transports();
    t.semantic.set(proposed());
    t.semantic.correctSemantic.mockImplementation(async () => yes('STALE' as const) as never);
    const { authoring } = await mount('en', t);
    await act(async () => { authoring.openCorrection(); });
    await act(async () => { authoring.submitCorrection('A parent afraid of losing work', 'parenthood', ''); });
    await flush();
    expect(authoring.getState().correcting).toBe(false);
    expect(authoring.getState().notice).toBe('ACTION_UNAVAILABLE');
    expect(t.semantic.semanticReview.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes the reader\'s words exactly as the server bounds them', () => {
    expect(semanticCorrectionOf(' a  b ', 'x ،y', '')).toEqual({ meaning: 'a b', primaryThemes: ['x', 'y'], secondaryThemes: [] });
    expect(semanticCorrectionOf('m', 'x,X', '')).toBeNull();
    expect(semanticCorrectionOf('m', 'x', 'a,b,c,d')).toBeNull();
  });
});

describe('S5-03A client', () => {
  // The semantic client is reached the way the app reaches it: on the Public World transport, through the barrel.
  const client = (body: unknown, ok = true) => new PublicWorldApiClient({
    baseUrl: 'https://api.test',
    fetch: jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as never,
  }).semantic;
  const wire = { state: 'AWAITING_REVIEW', interpretationId: INTERPRETATION, revision: 1, origin: 'QANDEEL', meaning: 'm', primaryThemes: ['a'],
    secondaryThemes: [], explanation: 'e', decision: null, ready: false };

  it('decodes the semantic review strictly', async () => {
    expect(await client(wire).semanticReview(EXPERIENCE)).toEqual({ kind: 'ANSWER', value: wire });
    expect(await client({ state: 'NO_PROPOSAL', ready: false }).semanticReview(EXPERIENCE)).toEqual({ kind: 'ANSWER', value: { state: 'NO_PROPOSAL', ready: false } });
    for (const bad of [{ ...wire, state: 'PUBLISHED' }, { ...wire, origin: 'MODEL' }, { ...wire, interpretationId: 'x' }, { ...wire, primaryThemes: [1] },
      { ...wire, decision: 'MAYBE' }, { state: 'NO_PROPOSAL', ready: true }]) {
      expect(await client(bad).semanticReview(EXPERIENCE)).toEqual({ kind: 'NO_ANSWER' });
    }
    expect(await client(wire, false).semanticReview(EXPERIENCE)).toEqual({ kind: 'NO_ANSWER' });
  });

  it('sends a correction as the command, the revision seen, and the reader\'s words — nothing else', async () => {
    const fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ outcome: 'CORRECTED' }) }));
    const api = new PublicWorldApiClient({ baseUrl: 'https://api.test', fetch: fetch as never }).semantic;
    expect(await api.correctSemantic(EXPERIENCE, id(1), INTERPRETATION, { meaning: 'm', primaryThemes: ['a'], secondaryThemes: [] }))
      .toEqual({ kind: 'ANSWER', value: 'CORRECTED' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`https://api.test/public/authoring/drafts/${EXPERIENCE}/semantic/correction`);
    expect(JSON.parse(init.body)).toEqual({ commandId: id(1), interpretationId: INTERPRETATION, meaning: 'm', primaryThemes: ['a'], secondaryThemes: [] });
    expect(await client({ outcome: 'PUBLISHED' }).proposeSemantic(EXPERIENCE, id(1))).toEqual({ kind: 'NO_ANSWER' });
    expect(await client({ outcome: 'ACCEPTED' }).acceptSemantic(EXPERIENCE, id(1), INTERPRETATION)).toEqual({ kind: 'ANSWER', value: 'ACCEPTED' });
  });
});

describe('S5-03A Product Copy Gate', () => {
  it('is OPEN, every new row PROPOSED (none approved by being written), reused words byte-exact, bilingual and in register', () => {
    expect(PUBLIC_SEMANTIC_COPY_GATE.status).toBe('S5-03A PRODUCT COPY GATE — OPEN — 21 rows PROPOSED');
    expect(PUBLIC_SEMANTIC_COPY_GATE.proposed).toHaveLength(21);
    expect(PUBLIC_SEMANTIC_COPY_GATE.approved).toEqual([]);
    expect(publicSemanticCopy('ar').cancel).toBe('إلغاء');
    expect(publicSemanticCopy('en').actionUnavailable).toBe(publicAuthoringCopy('en').actionUnavailable);
    const rows = [...PUBLIC_SEMANTIC_COPY_GATE.proposed, ...PUBLIC_SEMANTIC_COPY_GATE.reused];
    for (const language of ['ar', 'en'] as const) {
      const words = publicSemanticCopy(language);
      expect(Object.keys(words).sort()).toEqual([...rows].sort());
      for (const row of rows) {
        const text = words[row];
        expect(typeof text === 'string' && text.length > 0).toBe(true);
        expect(text).not.toMatch(/!|Published|نُشرت|منشورة/u);
        expect(text).not.toMatch(/coordinate|lens|vector|embedding|placement|model|prompt|إحداثي|خريطة|map/iu);
      }
    }
  });
});
