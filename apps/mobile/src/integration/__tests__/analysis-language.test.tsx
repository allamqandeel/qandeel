/**
 * W1A-01 correction pass — the language census of the PRODUCTION Analysis depth.
 *
 * The Analysis depth is composed exactly as the route composes it (`DepthComposition` over a runtime
 * the harness genuinely built), opened through its door, and then EVERY string it exposes — visible
 * text, accessible names, hints, values and action labels — is collected. In Arabic none of them may
 * carry a Latin-script word, and in either language none may carry an internal identifier.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { MAP_SURFACE_TEST_ID } from '../../map';
import type { ChromeLanguage } from '../../orientation-chrome';
import { resize } from '../../responsive/__fixtures__/composition';
import { DepthComposition } from '../composition/DepthComposition';
import { productLocale } from '../locale/product-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };

async function analysisIn(language: ChromeLanguage): Promise<{ view: RenderResult; h: IntegrationHarness }> {
  const h = await harness();
  h.http.on('/turns', () => ({ status: 200, body: historyBody([exchange('fixture: words')]) }));
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DepthComposition
        runtime={h.ready()}
        locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')}
        insets={METRICS.insets}
        fontScale={1}
        envelope={{ width: 390, height: 844 }}
      />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  await fireEvent.press(view.getByTestId('qandeel-depth-to-analysis'));
  await act(async () => {
    await settle();
  });
  await resize(view, 390, 844, { insetTop: 104, insetBottom: 34 });
  await act(async () => {
    await settle();
  });
  return { view, h };
}

/** Every visible and assistive string of the Analysis depth, with where it came from. */
function census(view: RenderResult): { readonly where: string; readonly text: string }[] {
  const out: { where: string; text: string }[] = [];
  const root = view.getByTestId('qandeel-depth-analysis', { includeHiddenElements: true });
  const visit = (node: unknown, where: string) => {
    if (typeof node === 'string') return void out.push({ where, text: node });
    if (node === null || typeof node !== 'object') return;
    const n = node as { props?: Record<string, unknown>; children?: unknown[] | null };
    const props = n.props ?? {};
    const here = typeof props.testID === 'string' ? props.testID : where;
    for (const key of ['accessibilityLabel', 'accessibilityHint', 'placeholder']) {
      if (typeof props[key] === 'string') out.push({ where: `${here}.${key}`, text: props[key] as string });
    }
    const value = props.accessibilityValue as { text?: string } | undefined;
    if (value?.text !== undefined) out.push({ where: `${here}.accessibilityValue`, text: value.text });
    for (const action of (props.accessibilityActions as { label?: string }[] | undefined) ?? []) {
      if (action.label !== undefined) out.push({ where: `${here}.action`, text: action.label });
    }
    for (const child of n.children ?? []) visit(child, here);
  };
  visit(root, 'analysis');
  return out;
}

/** Engineering tokens and identifiers that must never reach a reader in either language. */
const INTERNAL = [/SOURCE_PROVENANCE|ANALYTICAL_OBJECT|THREAD_READING|FOLLOW_LIVE|PINNED|WORLD\b/u, /thread-[a-z0-9]/iu, /reading-[a-z0-9]/iu, /binding/iu, /\bSP\b/u, /[0-9a-f]{8}-[0-9a-f]{4}-/iu, /fixture/iu];

describe('W1A-01 — the production Analysis depth speaks the reader’s language', () => {
  it('Arabic: no Latin-script Product word and no internal identifier anywhere in the Analysis depth', async () => {
    const { view, h } = await analysisIn('ar');
    expect(view.getByTestId(MAP_SURFACE_TEST_ID)).toBeTruthy();
    const strings = census(view);
    expect(strings.length).toBeGreaterThan(20);
    const latin = strings.filter(({ text }) => /[A-Za-z]/u.test(text));
    expect(latin).toEqual([]);
    for (const { where, text } of strings) {
      for (const pattern of INTERNAL) expect({ where, text, leaks: pattern.test(text) }).toEqual({ where, text, leaks: false });
    }
    // The Product Owner's current-edge wording is the one in use; the superseded wording is gone.
    const all = strings.map(({ text }) => text).join('\n');
    expect(all).toMatch(/تتابع المحادثة الآن|العودة لمتابعة المحادثة/u);
    for (const old of ['أنت عند آخر المحادثة', 'العودة إلى المحادثة الجارية', 'مباشر']) expect(all).not.toContain(old);
    expect(all).toContain('خريطة تحليل المحادثة');
    view.unmount();
    h.dispose();
  });

  it('English stays English, says no "Live", and exposes no internal identifier', async () => {
    const { view, h } = await analysisIn('en');
    const strings = census(view);
    const all = strings.map(({ text }) => text).join('\n');
    expect(all).not.toMatch(/[؀-ۿ]/u);
    expect(all).not.toMatch(/\bLive\b|Go live|live edge/u);
    expect(all).toContain('Conversation analysis map');
    for (const { where, text } of strings) {
      for (const pattern of INTERNAL) expect({ where, text, leaks: pattern.test(text) }).toEqual({ where, text, leaks: false });
    }
    view.unmount();
    h.dispose();
  });
});
