/**
 * S6-01 / CP3 VIS-2 — the Living Portrait (Product Owner decision 2026-10-14: direction A, refinements R1–R4).
 *
 * The owner's private preparation drawn as what it is: a small number of meaningful groups — About you, What matters to
 * you, Dealbreakers and preferences — holding ONLY what the server says is settled (`projectPortrait`). Nothing in it is
 * decorative and nothing counts: a group appears when the owner has given it real content, and grows with that content.
 *
 *   COMPACT    while preparing on a small or crowded screen: each group keeps its newest words; the rest stays one tap
 *              away (the group's name is the disclosure), so the current question remains the primary interaction (R2).
 *   EXPANDED   while preparing with room to spare, or when the owner opens it: every word.
 *   COMPOSED   the review: the whole portrait, the owner's name in the 24/38 role, each part editable by progressive
 *              disclosure (R3).
 *
 * Distinctions are made by shape and ink only (E1): confirmed facts are plain lines; the owner's priorities are quoted in
 * their own words; a dealbreaker is a closed outline and a preference an open one. Something NOT settled is never drawn
 * here — it waits in "Not settled yet" (`OpenBand`) with its own mark.
 *
 * VIS-3P (premium polish, no new copy): one hierarchy for the whole portrait. The name heads the facts it is the subject
 * of, and the facts are its quieter subtitle; the owner's own words are the brightest text after the name, their quotation
 * marks hung in the margin; in the review, a hairline and an even rhythm separate the parts; a preference's open outline is
 * a single bracket on the reading side (the closed outline's counterpart); and the place a remembered item would take is a
 * blank line waiting for the owner's words.
 *
 * A change the server applied may be SHOWN arriving (T-10 M3, ≤ 260 ms, opacity and a short rise from the band below);
 * no light is used (R4: QANDEEL Light is the D2R Analysis grammar, and a fifth kind of light event is a Product decision).
 * Under Reduced Motion the same words appear at once, and the confirmation is announced either way by the surface.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, PixelRatio, Text, View } from 'react-native';

import { typeStyle } from '../conversation';
import { MOTION_DURATIONS_MS, QANDEEL_EASE_OUT } from '../motion';
import type { IntroductionsCopy } from './copy';
import { Action, LOCAL_TYPE, OpenMark, Quote, QUOTE_MARKS, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import type { Portrait, PortraitBound, PortraitOpenItem, PortraitValue } from './portrait-projection';

export type PortraitMode = 'COMPACT' | 'EXPANDED' | 'COMPOSED';
export type PortraitGroup = 'ABOUT' | 'MATTERS' | 'BOUNDS';

const FRAME_RADIUS = 14;
const FRAME_STROKE = 1;
/** The open outline: one bracket on the reading side, as tall as the frame. */
const BRACKET = 12;
/** The review's rhythm: the same space before every part, and a hairline between parts. */
const PART_GAP = 22;
const DASHES = 80;
const RISE = 12;
/** Two frames share a line while each keeps this much room; with larger text they stack. */
const FRAME_BASIS = 128;
const COMPACT_LINES = 2;

const ease = Easing.bezier(...QANDEEL_EASE_OUT);

/** Shows a server-confirmed arrival: the words rise from the band into their place. Static under Reduced Motion. */
function Arrival({ arriving, reduceMotion, children }: { readonly arriving: boolean; readonly reduceMotion: boolean; readonly children: ReactNode }) {
  const animate = arriving && !reduceMotion;
  const [progress] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, { toValue: 1, duration: MOTION_DURATIONS_MS.disclosureReinforcement, easing: ease, useNativeDriver: true }).start();
    // Only an arrival that mounts is shown arriving; a re-render never replays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!animate) return <View>{children}</View>;
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Caption({ ctx, text, toggle, edit, testID }: {
  readonly ctx: PartContext; readonly text: string; readonly testID: string;
  /** While preparing: the group's name opens or closes the whole portrait. */
  readonly toggle?: { readonly expanded: boolean; readonly onPress: () => void };
  /** In the review: the part's own Edit, which discloses its details. */
  readonly edit?: { readonly open: boolean; readonly label: string; readonly closeLabel: string; readonly onPress: () => void; readonly testID: string };
}) {
  const name = toggle === undefined ? (
    <Text accessibilityRole="header" accessibilityLanguage={ctx.language} testID={testID}
      style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, flexShrink: 1, writingDirection: ctx.writing }}>
      {text}
    </Text>
  ) : (
    <Action ctx={{ ...ctx, busy: false }} inline label={text} expanded={toggle.expanded} onPress={toggle.onPress} testID={testID} />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: edit || toggle ? 44 : 28, columnGap: 12,
      marginStart: toggle ? -8 : 0, marginEnd: edit ? -8 : 0 }}>
      {name}
      {edit === undefined ? null : (
        <Action ctx={ctx} inline label={edit.open ? edit.closeLabel : edit.label} accessibilityLabel={`${edit.open ? edit.closeLabel : edit.label}: ${text}`}
          expanded={edit.open} onPress={edit.onPress} testID={edit.testID} />
      )}
    </View>
  );
}

/** A short line of whole values that wraps between values, never inside one: "Female · May 1996". */
function ValueLine({ ctx, values, landed, reduceMotion }: {
  readonly ctx: PartContext; readonly values: readonly PortraitValue[]; readonly landed: ReadonlySet<string>; readonly reduceMotion: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {values.map((v, i) => (
        <Arrival key={v.key} arriving={landed.has(v.key)} reduceMotion={reduceMotion}>
          <View style={{ flexDirection: 'row' }}>
            <Text testID={`qandeel-introductions-portrait-${v.key}`} style={{ ...typeStyle('supporting'), color: ctx.palette.secondary, writingDirection: ctx.writing }}>{v.value}</Text>
            {i < values.length - 1 ? (
              <Text accessibilityElementsHidden importantForAccessibility="no" style={{ ...typeStyle('supporting'), color: ctx.palette.tertiary, paddingHorizontal: 6 }}>·</Text>
            ) : null}
          </View>
        </Arrival>
      ))}
    </View>
  );
}

/**
 * The place a remembered item would take once the owner confirms it — never content: a blank, dashed line opened by a
 * quotation mark (the owner's words will be written here), with what confirming does beneath it.
 */
function Landing({ ctx, copy }: { readonly ctx: PartContext; readonly copy: IntroductionsCopy }) {
  return (
    <View testID="qandeel-introductions-landing" style={{ paddingTop: 10 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6, minHeight: 24 }}>
        <Text style={{ ...typeStyle('supporting'), color: ctx.palette.tertiary }}>{QUOTE_MARKS[ctx.language][0]}</Text>
        {/* Whole dashes only: those that do not fit wrap onto a hidden second line. */}
        <View style={{ flex: 1, height: 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 5, overflow: 'hidden' }}>
          {Array.from({ length: DASHES }, (_, i) => <View key={i} style={{ width: 6, height: 1.5, borderRadius: 1, backgroundColor: ctx.palette.tertiary }} />)}
        </View>
      </View>
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, paddingTop: 2, writingDirection: ctx.writing }}>{copy.afterConfirmPrior}</Text>
    </View>
  );
}

function Added({ ctx, copy, at }: { readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly at?: (node: Text | null) => void }) {
  return <Text ref={at} testID="qandeel-introductions-added" style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, writingDirection: ctx.writing }}>{copy.added}</Text>;
}

/**
 * A dealbreaker is a closed outline; a preference an open one — a single bracket on the reading side. Shape and ink,
 * never a hue; and the words say it too: each frame is announced as one item that begins with its kind.
 */
function Frame({ ctx, kind, title, items, testID }: {
  readonly ctx: PartContext; readonly kind: 'HARD' | 'SOFT'; readonly title: string; readonly items: readonly PortraitBound[]; readonly testID: string;
}) {
  const ink = kind === 'HARD' ? ctx.palette.primary : ctx.palette.secondary;
  const label = [title, ...items.map((item) => (item.label === null ? item.value : `${item.label}: ${item.value}`))].join(ctx.language === 'ar' ? '، ' : ', ');
  return (
    <View testID={testID} accessible accessibilityLabel={label} accessibilityLanguage={ctx.language} style={{
      flexGrow: 1, flexBasis: FRAME_BASIS * Math.max(1, PixelRatio.getFontScale()), minHeight: 56, borderRadius: FRAME_RADIUS,
      paddingStart: kind === 'HARD' ? 14 : 18, paddingEnd: 14, paddingTop: 10, paddingBottom: 12,
      ...(kind === 'HARD' ? { borderWidth: FRAME_STROKE, borderColor: ink } : {}),
    }}>
      {kind === 'SOFT' ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: BRACKET, borderColor: ink, borderTopWidth: FRAME_STROKE,
          borderStartWidth: FRAME_STROKE, borderBottomWidth: FRAME_STROKE, borderTopStartRadius: FRAME_RADIUS, borderBottomStartRadius: FRAME_RADIUS }} />
      ) : null}
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, writingDirection: ctx.writing }}>{title}</Text>
      {items.map((item, i) => (
        <View key={`${item.label ?? ''}${i}`} style={{ paddingTop: 6 }}>
          {item.label === null ? null : <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, writingDirection: ctx.writing }}>{item.label}</Text>}
          <Text style={{ ...typeStyle('supporting'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export interface LivingPortraitProps {
  readonly ctx: PartContext;
  readonly copy: IntroductionsCopy;
  readonly portrait: Portrait;
  readonly mode: PortraitMode;
  /** Keys a server-confirmed change has just added. */
  readonly landed: ReadonlySet<string>;
  readonly reduceMotion: boolean;
  /** The open item the current step is about: where it would land is shown, if it is a remembered one. */
  readonly current?: PortraitOpenItem | null;
  /** COMPACT / EXPANDED: open or close the whole portrait. */
  readonly onToggle?: () => void;
  /** COMPOSED: the part whose details are open, and how to open one. Absent: read-only. */
  readonly edit?: { readonly open: PortraitGroup | null; readonly onEdit: (group: PortraitGroup) => void; readonly details: ReactNode };
  /** Receives "Added to your preparation." when it is shown, so the step can open with the arrival in view. */
  readonly addedAt?: (node: Text | null) => void;
}

export function LivingPortrait({ ctx, copy, portrait: p, mode, landed, reduceMotion, current = null, onToggle, edit, addedAt }: LivingPortraitProps) {
  const compact = mode === 'COMPACT';
  const landsIn = current?.lands ?? null;
  // Compact keeps each group's newest words (or the ones that just arrived); the rest stays one tap away.
  const visible = <T extends { readonly key: string }>(items: readonly T[]) =>
    !compact ? items : items.filter((item, i) => landed.has(item.key) || (i === items.length - 1 && !items.some((x) => landed.has(x.key))));
  const quoteLines = compact ? COMPACT_LINES : undefined;
  const toggle = (has: boolean) => (mode === 'COMPOSED' || onToggle === undefined || !has ? undefined : { expanded: !compact, onPress: onToggle });
  const editOf = (group: PortraitGroup) => (edit === undefined ? undefined : {
    open: edit.open === group, label: copy.edit, closeLabel: copy.cancel, onPress: () => edit.onEdit(group), testID: `qandeel-introductions-edit-group-${group}`,
  });

  const aboutQuotes: { key: string; body: string; role: 'body' | 'supporting' }[] = [
    ...(p.intro === null ? [] : [{ key: p.intro.key, body: p.intro.value, role: 'supporting' as const }]),
    ...p.about.map((n) => ({ key: n.key, body: n.body, role: 'supporting' as const })),
  ];
  // "Added to your preparation." is written once, under the last of the words that just arrived.
  const order = [...(p.name === null ? [] : [p.name.key]), ...p.lines.flat().map((v) => v.key), ...aboutQuotes.map((q) => q.key), ...p.matters.map((n) => n.key), 'hard', 'soft'];
  const lastKey = order.filter((key) => landed.has(key)).pop();
  const addedAfter = (key: string) => key === lastKey;
  const factArrived = [p.name, ...p.lines.flat()].some((v) => v !== null && addedAfter(v.key));
  const hasAbout = p.name !== null || p.lines.length > 0 || aboutQuotes.length > 0 || landsIn === 'ABOUT';
  const hasMatters = p.matters.length > 0 || landsIn === 'MATTERS';
  const hasBounds = p.hard !== null || p.soft !== null;
  const composed = mode === 'COMPOSED';
  const firstGroup: PortraitGroup = hasAbout ? 'ABOUT' : hasMatters ? 'MATTERS' : 'BOUNDS';
  const group = (key: PortraitGroup, children: ReactNode) => (
    <View key={key} testID={`qandeel-introductions-portrait-${key}`} style={{ paddingTop: !composed ? 12 : key === firstGroup ? 8 : PART_GAP }}>
      {composed && key !== firstGroup ? <View style={{ height: 1, backgroundColor: ctx.palette.tertiary, opacity: 0.3, marginBottom: 10 }} /> : null}
      {children}
    </View>
  );

  return (
    <View testID="qandeel-introductions-portrait" accessibilityLanguage={ctx.language} style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
      {!hasAbout ? null : group('ABOUT', (<>
        <Caption ctx={ctx} text={copy.clusterAbout} toggle={toggle(aboutQuotes.length > 0)} edit={editOf('ABOUT')} testID="qandeel-introductions-portrait-caption-ABOUT" />
        {/* The name heads the facts it is the subject of: in the review in the 24/38 role, while preparing in the 17. */}
        {p.name === null ? null : (
          <Arrival arriving={landed.has(p.name.key)} reduceMotion={reduceMotion}>
            {composed
              ? <Text testID="qandeel-introductions-portrait-name" accessibilityRole="header" style={{ ...LOCAL_TYPE.name, color: ctx.palette.primary, paddingBottom: 2, writingDirection: ctx.writing }}>{p.name.value}</Text>
              : <Text testID="qandeel-introductions-portrait-name" style={{ ...LOCAL_TYPE.header, color: ctx.palette.primary, writingDirection: ctx.writing }}>{p.name.value}</Text>}
          </Arrival>
        )}
        {p.lines.map((line) => <ValueLine key={line.map((v) => v.key).join('|')} ctx={ctx} values={line} landed={landed} reduceMotion={reduceMotion} />)}
        {factArrived ? <Added ctx={ctx} copy={copy} at={addedAt} /> : null}
        {visible(aboutQuotes).map((q) => (
          <Arrival key={q.key} arriving={landed.has(q.key)} reduceMotion={reduceMotion}>
            <View style={{ paddingTop: 10 }}>
              <Quote ctx={ctx} text={q.body} role={q.role} outdent numberOfLines={quoteLines} testID={`qandeel-introductions-portrait-${q.key}`} />
              {addedAfter(q.key) ? <Added ctx={ctx} copy={copy} at={addedAt} /> : null}
            </View>
          </Arrival>
        ))}
        {landsIn === 'ABOUT' ? <Landing ctx={ctx} copy={copy} /> : null}
        {edit?.open === 'ABOUT' ? edit.details : null}
      </>))}

      {!hasMatters ? null : group('MATTERS', (<>
        <Caption ctx={ctx} text={copy.notesHeading} toggle={toggle(p.matters.length > 0)} testID="qandeel-introductions-portrait-caption-MATTERS" />
        {visible(p.matters).map((n) => (
          <Arrival key={n.key} arriving={landed.has(n.key)} reduceMotion={reduceMotion}>
            <View style={{ paddingBottom: composed ? 12 : 6 }}>
              <Quote ctx={ctx} text={n.body} outdent numberOfLines={quoteLines} testID={`qandeel-introductions-portrait-${n.key}`} />
              {addedAfter(n.key) ? <Added ctx={ctx} copy={copy} at={addedAt} /> : null}
            </View>
          </Arrival>
        ))}
        {landsIn === 'MATTERS' ? <Landing ctx={ctx} copy={copy} /> : null}
      </>))}

      {!hasBounds ? null : group('BOUNDS', (<>
        <Caption ctx={ctx} text={copy.clusterBounds} edit={editOf('BOUNDS')} testID="qandeel-introductions-portrait-caption-BOUNDS" />
        <Arrival arriving={landed.has('hard') || landed.has('soft')} reduceMotion={reduceMotion}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
            {p.hard === null ? null : <Frame ctx={ctx} kind="HARD" title={copy.hardTitle} items={p.hard} testID="qandeel-introductions-portrait-hard" />}
            {p.soft === null ? null : <Frame ctx={ctx} kind="SOFT" title={copy.softTitle} items={p.soft} testID="qandeel-introductions-portrait-soft" />}
          </View>
          {addedAfter('hard') || addedAfter('soft') ? <Added ctx={ctx} copy={copy} at={addedAt} /> : null}
        </Arrival>
        {edit?.open === 'BOUNDS' ? edit.details : null}
      </>))}

      {composed && p.notIncluded.length > 0 ? (
        <Text testID="qandeel-introductions-not-included" style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, paddingTop: 16, writingDirection: ctx.writing }}>
          {`${copy.stateNotIncluded}: ${p.notIncluded.join(ctx.language === 'ar' ? '، ' : ', ')}`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * "Not settled yet": the one item the current step is about, apart from the portrait and marked as unsettled — what was
 * given or remembered and still awaits the owner. Never drawn as knowledge.
 */
export function OpenBand({ ctx, copy, item, lead, title, trailing, textTestID }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly item: PortraitOpenItem;
  /** A line before the item: where it came from. */
  readonly lead?: string | null;
  /** What the item is (a fact's name), when it is not the owner's own words. */
  readonly title?: string | null;
  readonly trailing?: ReactNode;
  readonly textTestID: string;
}) {
  const quoted = item.key.startsWith('prior:');
  return (
    <View testID="qandeel-introductions-band" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingBottom: 12 }}>
      <View style={{ height: 1, backgroundColor: ctx.palette.tertiary, opacity: 0.3 }} />
      {/* The caption is never broken inside a word; when the row has no room (large text), the action moves under it. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', minHeight: trailing ? 44 : 32, columnGap: 12, marginEnd: trailing ? -8 : 0 }}>
        <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, flexShrink: 0, writingDirection: ctx.writing }}>{copy.clusterOpen}</Text>
        {trailing ?? null}
      </View>
      {lead ? <Text style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, paddingBottom: 2, writingDirection: ctx.writing }}>{lead}</Text> : null}
      <View
        accessible
        accessibilityLanguage={ctx.language}
        accessibilityLabel={`${item.state === 'TO_CONFIRM' ? copy.stateDeclared : copy.clusterOpen}: ${title ? `${title}${ctx.language === 'ar' ? '، ' : ', '}` : ''}${item.text}`}
        style={{ flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 }}
      >
        <View style={{ paddingTop: 10 }}><OpenMark ctx={ctx} state={item.state} /></View>
        <View style={{ flex: 1 }}>
          {title ? <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, writingDirection: ctx.writing }}>{title}</Text> : null}
          {quoted
            ? <Quote ctx={ctx} text={item.text} testID={textTestID} />
            : <Text testID={textTestID} style={{ ...typeStyle('body'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{item.text}</Text>}
        </View>
      </View>
    </View>
  );
}
