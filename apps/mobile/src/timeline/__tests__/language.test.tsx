/**
 * W1A-01 correction pass — the Timeline speaks the reader's language, and its command field accepts
 * the approved commands of BOTH languages, so an Arabic reader never has to type English.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { analysisCopy, presentationCommandHelper } from '../../analysis-language';
import { runPresentationCommand } from '../accessibility/commands';
import { fixture } from '../testing/fixtures';
import { createPresentationController } from '../window/controller';
import { TimelinePresentation } from '../virtualization/TimelinePresentation';

jest.setTimeout(60_000);

/** Every string a reader can see or hear on the rendered subtree. */
function spoken(): string[] {
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (node === null || typeof node !== 'object') {
      if (typeof node === 'string') out.push(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as { props: Record<string, unknown>; children: unknown[] | null };
    for (const key of ['accessibilityLabel', 'accessibilityHint']) if (typeof n.props[key] === 'string') out.push(n.props[key] as string);
    const value = n.props.accessibilityValue as { text?: string } | undefined;
    if (value?.text !== undefined) out.push(value.text);
    for (const action of (n.props.accessibilityActions as { label?: string }[] | undefined) ?? []) if (action.label !== undefined) out.push(action.label);
    (n.children ?? []).forEach(visit);
  };
  visit(screen.toJSON());
  return out;
}

describe('the Timeline in Arabic', () => {
  it('every visible and assistive string is the approved Arabic — no English Product word, no internal token', async () => {
    const c = createPresentationController(fixture(20), 240);
    await render(<TimelinePresentation controller={c} language="ar" outboardLivePresentation={null} />);
    const ar = analysisCopy('ar');
    expect(screen.getByTestId('timeline-sp-3').props.accessibilityLabel).toBe('اللحظة 3');
    const position = screen.getByTestId('timeline-position');
    expect(position.props.accessibilityLabel).toBe('موضع العرض على الخط الزمني');
    expect(position.props.accessibilityValue.text).toBe('0% من نطاق العرض');
    expect(position.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
      'التالي', 'السابق', 'البداية', 'النهاية', 'تضييق نطاق العرض', 'توسيع نطاق العرض',
    ]);
    expect(screen.getByTestId('timeline-command').props.accessibilityLabel).toBe(ar.moveView);
    expect(screen.getByTestId('timeline-command').props.accessibilityHint).toBe(presentationCommandHelper('ar'));
    for (const text of spoken()) {
      // Latin letters appear only in no string at all (digits, % and +/- are not words).
      expect(text).not.toMatch(/[A-Za-z]/u);
    }
  });

  it('the helper and the error name only approved Arabic command words', async () => {
    expect(presentationCommandHelper('ar')).toBe('البداية، النهاية، التالي، السابق، تضييق، توسيع، +، -، 0–100%');
    const c = createPresentationController(fixture(20), 240);
    await render(<TimelinePresentation controller={c} language="ar" />);
    await fireEvent.changeText(screen.getByTestId('timeline-command'), 'xyz');
    await fireEvent(screen.getByTestId('timeline-command'), 'submitEditing');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getAllByText(presentationCommandHelper('ar')).length).toBeGreaterThan(0);
  });
});

describe('bilingual presentation commands', () => {
  it.each([
    ['البداية', 0],
    ['first', 0],
    ['النهاية', 1],
    ['last', 1],
  ])('%s moves to the %s end', (command, position) => {
    const c = createPresentationController(fixture(20), 240);
    expect(runPresentationCommand(c, command)).toBe(true);
    expect(c.getSnapshot().position).toBe(position);
  });

  it('Arabic and English next / previous page the same way', () => {
    const a = createPresentationController(fixture(40), 240);
    const b = createPresentationController(fixture(40), 240);
    expect(runPresentationCommand(a, 'التالي')).toBe(true);
    expect(runPresentationCommand(b, 'next')).toBe(true);
    expect(a.getSnapshot().offset).toBe(b.getSnapshot().offset);
    expect(runPresentationCommand(a, 'السابق')).toBe(true);
    expect(runPresentationCommand(b, 'previous')).toBe(true);
    expect(a.getSnapshot().offset).toBe(b.getSnapshot().offset);
  });

  it('Arabic narrow / widen are refine / widen', () => {
    for (const [ar, en] of [['تضييق', 'refine'], ['توسيع', 'widen']]) {
      const a = createPresentationController(fixture(40), 240);
      const b = createPresentationController(fixture(40), 240);
      a.move({ type: 'PRESENTATION_POSITION_MOVE', position: 0.5 });
      b.move({ type: 'PRESENTATION_POSITION_MOVE', position: 0.5 });
      expect(runPresentationCommand(a, ar)).toBe(true);
      expect(runPresentationCommand(b, en)).toBe(true);
      expect(a.getSnapshot()).toEqual(b.getSnapshot());
    }
  });

  it('percentages in Western or Arabic-Indic digits, with either percent sign, and + / -', () => {
    const a = createPresentationController(fixture(40), 240);
    const b = createPresentationController(fixture(40), 240);
    expect(runPresentationCommand(a, '٥٠٪')).toBe(true);
    expect(runPresentationCommand(b, '50%')).toBe(true);
    expect(a.getSnapshot().position).toBe(b.getSnapshot().position);
    expect(runPresentationCommand(a, '+')).toBe(true);
    expect(runPresentationCommand(a, '-')).toBe(true);
    expect(runPresentationCommand(a, '١٠١')).toBe(false);
    expect(runPresentationCommand(a, 'something')).toBe(false);
  });

  it('English mode stays English', async () => {
    const c = createPresentationController(fixture(20), 240);
    await render(<TimelinePresentation controller={c} language="en" />);
    expect(screen.getByTestId('timeline-position').props.accessibilityLabel).toBe('Timeline view position');
    expect(screen.getByTestId('timeline-command').props.accessibilityLabel).toBe('Move the timeline view');
    await act(async () => c.move({ type: 'PRESENTATION_POSITION_MOVE', position: 1 }));
    expect(screen.getByTestId('timeline-position').props.accessibilityValue.text).toBe('100% of the view range');
  });
});
