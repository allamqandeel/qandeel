/**
 * S6-01 — «التعارف مع قنديل» / Introductions with QANDEEL: the owner's private preparation (CW2-06A), a depth of
 * Personal QANDEEL shown over the Personal world, exactly like Understanding. Not a route, a world, a tab or a feed.
 *
 *   - One purposeful step at a time. Which step comes next is the server's objective plan (N / K / C), never a fixed
 *     questionnaire: the surface renders the objective it is given, in the approved deterministic words (the phrasing
 *     seam is UNBOUND until Stage 8A).
 *   - Prior understanding appears only after the owner's separate permission, one item at a time, in the owner's own
 *     words, for the owner to confirm, correct, mark no longer true, or decline. Nothing is presumed.
 *   - Nothing reads as enrollment, participation, eligibility or a match: the end of preparation says plainly that
 *     enrollment is not available yet.
 *   - Arabic and English mirror by logical layout; every target is 44 points; nothing has a fixed width (320 points).
 *
 * VIS-2 — the Living Portrait (Product Owner decision 2026-10-14, direction A with R1–R4). What the server says is
 * settled is drawn on the World as the owner's portrait (`LivingPortrait`); the one thing the current step is about
 * waits in "Not settled yet" (`OpenBand`); the current question is the one prominent act, on the Field ("the sheet").
 *   R1  the portrait grows only from confirmed content: nothing is drawn for what was not given, and nothing counts.
 *   R2  while preparing, the portrait is compact unless there is room (or the owner opens it), and always compact while
 *       the keyboard is up; the question is where the screen reader arrives, and the sheet stays above the keyboard.
 *   R3  the review is the composed portrait, each part editable by progressive disclosure.
 *   R4  no light: a server-confirmed arrival may rise into place (T-10 M3); the confirmation is announced regardless,
 *       and Reduced Motion shows the same words at once.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, findNodeHandle, useWindowDimensions } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette, useReduceMotion } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionsDraft, IntroductionsFact, IntroductionsObjective, IntroductionsView } from '../runtime-entry';
import { AREA_COUNTRIES, areaName, regionsOf } from './area-catalogue';
import { ASSISTANCE_CONSENT_TEXT, MONTHS, WORK_FIELD_NAMES, introductionsCopy, type IntroductionsCopy } from './copy';
import type { IntroductionsController } from './introductions-controller';
import { Action, ActionRow, Choice, Field, Heading, LOCAL_TYPE, Para, Question, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import { LivingPortrait, OpenBand, type PortraitGroup } from './Portrait';
import { MARITAL, arrivals, factTitle, factValue, portraitIsEmpty, projectPortrait, requirementWords, type Portrait } from './portrait-projection';

export const INTRODUCTIONS_SURFACE_TEST_ID = 'qandeel-introductions';

export interface IntroductionsSurfaceProps {
  readonly controller: IntroductionsController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** Back to the Personal world, exactly as it was. */
  readonly onBack: () => void;
}

const HEADER_MIN_HEIGHT = 48;
const SHEET_RADIUS = 24;
/** A screen at least this tall (in points at the reader's text size) has room for the whole portrait while preparing. */
const ROOMY_HEIGHT = 720;
/** After a step changes, this share of the viewport above the current item still shows the portrait it joins. */
const PORTRAIT_GLIMPSE = 0.35;
/** With the keyboard up, the field being typed in sits this far down, so its question stays readable above it. */
const FIELD_CONTEXT = 132;
const NONE: ReadonlySet<string> = new Set();

type Editing = { readonly kind: 'FACT'; readonly fact: IntroductionsFact } | { readonly kind: 'HARD' | 'SOFT' | 'PROFILE' } | null;

// ------------------------------------------------------------------------------------------------------------------
// Editors (on the sheet).

function FactEditor({ ctx, copy, fact, draft, onSave, onCancel }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly fact: IntroductionsFact; readonly draft: IntroductionsDraft | null;
  readonly onSave: (payload: Record<string, unknown>) => void; readonly onCancel: (() => void) | null;
}) {
  const f = draft?.facts;
  const [name, setName] = useState(f?.firstName?.value ?? '');
  const [year, setYear] = useState(f?.birthYearMonth ? String(f.birthYearMonth.year) : '');
  const [month, setMonth] = useState<number | null>(f?.birthYearMonth?.month ?? null);
  const [country, setCountry] = useState<string | null>(f?.area?.countryCode ?? null);
  const [region, setRegion] = useState<string | null>(f?.area?.regionCode ?? null);
  const title = factTitle(fact, copy);
  const cancel = onCancel === null ? null : <Action ctx={ctx} label={copy.cancel} onPress={onCancel} testID="qandeel-introductions-cancel" />;
  let body: ReactNode = null;
  if (fact === 'INTRODUCTION_FIRST_NAME') {
    body = (<>
      <Para ctx={ctx} text={copy.firstNameHint} role="supporting" color={ctx.palette.secondary} />
      <Field ctx={ctx} label={title} value={name} onChange={setName} testID="qandeel-introductions-first-name" maxLength={32} />
      <Action ctx={ctx} label={copy.save} primary disabled={name.trim().length === 0} onPress={() => onSave({ fact, firstName: name.trim() })} testID="qandeel-introductions-save" />
    </>);
  } else if (fact === 'SEX') {
    body = (<>
      <Para ctx={ctx} text={copy.sexHint} role="supporting" color={ctx.palette.secondary} />
      <Choice ctx={ctx} label={copy.male} selected={f?.sex?.value === 'MALE'} onPress={() => onSave({ fact, sex: 'MALE' })} testID="qandeel-introductions-sex-male" />
      <Choice ctx={ctx} label={copy.female} selected={f?.sex?.value === 'FEMALE'} onPress={() => onSave({ fact, sex: 'FEMALE' })} testID="qandeel-introductions-sex-female" />
    </>);
  } else if (fact === 'BIRTH_YEAR_MONTH') {
    const y = Number(year);
    const valid = /^[0-9]{4}$/u.test(year) && y >= 1900 && month !== null;
    body = (<>
      <Para ctx={ctx} text={copy.birthHint} role="supporting" color={ctx.palette.secondary} />
      <Field ctx={ctx} label={copy.birthYear} value={year} onChange={(t) => setYear(t.replace(/[^0-9]/gu, ''))} testID="qandeel-introductions-birth-year" maxLength={4} numeric direction="ltr" />
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, paddingTop: 6, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: ctx.writing }}>{copy.birthMonth}</Text>
      {MONTHS[ctx.language].map((label, index) => (
        <Choice key={label} ctx={ctx} label={label} selected={month === index + 1} onPress={() => setMonth(index + 1)} testID={`qandeel-introductions-month-${index + 1}`} />
      ))}
      <Action ctx={ctx} label={copy.save} primary disabled={!valid} onPress={() => onSave({ fact, year: y, month })} testID="qandeel-introductions-save" />
    </>);
  } else if (fact === 'BROAD_AREA') {
    const regions = country === null ? [] : regionsOf(country);
    const valid = country !== null && (regions.length === 0 ? region === null : region !== null && regions.includes(region));
    body = (<>
      <Para ctx={ctx} text={copy.areaHint} role="supporting" color={ctx.palette.secondary} />
      <Heading ctx={ctx} text={copy.country} />
      {Object.keys(AREA_COUNTRIES).sort((a, b) => areaName(a, ctx.language).localeCompare(areaName(b, ctx.language), ctx.language)).map((code) => (
        <Choice key={code} ctx={ctx} label={areaName(code, ctx.language)} selected={country === code} onPress={() => { setCountry(code); setRegion(null); }} testID={`qandeel-introductions-country-${code}`} />
      ))}
      {regions.length === 0 ? null : <Heading ctx={ctx} text={copy.region} />}
      {regions.map((code) => (
        <Choice key={code} ctx={ctx} label={areaName(code, ctx.language)} selected={region === code} onPress={() => setRegion(code)} testID={`qandeel-introductions-region-${code}`} />
      ))}
      <Action ctx={ctx} label={copy.save} primary disabled={!valid} onPress={() => onSave({ fact, countryCode: country, regionCode: region })} testID="qandeel-introductions-save" />
    </>);
  } else {
    body = (<>
      {MARITAL.map((value) => (
        <Choice key={value} ctx={ctx} label={copy[value]} selected={f?.maritalStatus?.value === value} onPress={() => onSave({ fact, maritalStatus: value })} testID={`qandeel-introductions-marital-${value}`} />
      ))}
    </>);
  }
  return <View testID={`qandeel-introductions-edit-${fact}`}><Question ctx={ctx} text={title} testID="qandeel-introductions-step-heading" />{body}{cancel}</View>;
}

function RequirementsEditor({ ctx, copy, strength, draft, onSave, onCancel }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly strength: 'HARD' | 'SOFT'; readonly draft: IntroductionsDraft | null;
  readonly onSave: (payload: Record<string, unknown>) => void; readonly onCancel: (() => void) | null;
}) {
  const current = (strength === 'HARD' ? draft?.requirements.hard.items : draft?.requirements.soft.items) ?? [];
  const age = current.find((i) => i.dimension === 'AGE_RANGE');
  const marital = current.find((i) => i.dimension === 'MARITAL_STATUS');
  const area = current.find((i) => i.dimension === 'AREA');
  const [setting, setSetting] = useState(current.length > 0);
  const [ageOn, setAgeOn] = useState(age !== undefined);
  const [min, setMin] = useState(age?.min !== undefined ? String(age.min) : '');
  const [max, setMax] = useState(age?.max !== undefined ? String(age.max) : '');
  const [accepted, setAccepted] = useState<readonly string[]>(marital?.accepted ?? []);
  const [country, setCountry] = useState<string | null>(area?.countryCode ?? null);
  const [regions, setRegions] = useState<readonly string[]>(area?.regionCodes ?? []);
  const toggle = (list: readonly string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const items: Record<string, unknown>[] = [];
  const lo = Number(min);
  const hi = Number(max);
  const ageValid = !ageOn || (/^[0-9]{2}$/u.test(min) && /^[0-9]{2}$/u.test(max) && lo >= 18 && hi <= 99 && lo <= hi);
  if (ageOn && ageValid) items.push({ dimension: 'AGE_RANGE', min: lo, max: hi });
  if (accepted.length > 0) items.push({ dimension: 'MARITAL_STATUS', accepted: [...accepted] });
  if (country !== null) items.push(regions.length > 0 ? { dimension: 'AREA', countryCode: country, regionCodes: [...regions] } : { dimension: 'AREA', countryCode: country });
  const title = strength === 'HARD' ? copy.hardTitle : copy.softTitle;
  return (
    <View testID={`qandeel-introductions-requirements-${strength}`}>
      <Question ctx={ctx} text={title} testID="qandeel-introductions-step-heading" />
      <Para ctx={ctx} text={strength === 'HARD' ? copy.hardBody : copy.softBody} />
      {strength === 'HARD' ? <Para ctx={ctx} text={copy.systemRulesNote} role="supporting" color={ctx.palette.secondary} /> : null}
      <Choice ctx={ctx} label={strength === 'HARD' ? copy.hardNone : copy.softNone} selected={!setting && (strength === 'HARD' ? draft?.requirements.hard.answer === 'NONE_ADDITIONAL' : draft?.requirements.soft.answer === 'NONE')}
        onPress={() => onSave({ strength, answer: strength === 'HARD' ? 'NONE_ADDITIONAL' : 'NONE', items: [] })} testID="qandeel-introductions-requirements-none" />
      <Choice ctx={ctx} label={strength === 'HARD' ? copy.hardSet : copy.softSet} selected={setting} onPress={() => setSetting(true)} testID="qandeel-introductions-requirements-set" />
      {!setting ? null : (<>
        <Choice ctx={ctx} multiple label={copy.AGE_RANGE} selected={ageOn} onPress={() => setAgeOn(!ageOn)} testID="qandeel-introductions-dimension-AGE_RANGE" />
        {ageOn ? (<>
          <Field ctx={ctx} label={copy.ageFrom} value={min} onChange={(t) => setMin(t.replace(/[^0-9]/gu, ''))} testID="qandeel-introductions-age-min" maxLength={2} numeric direction="ltr" />
          <Field ctx={ctx} label={copy.ageTo} value={max} onChange={(t) => setMax(t.replace(/[^0-9]/gu, ''))} testID="qandeel-introductions-age-max" maxLength={2} numeric direction="ltr" />
        </>) : null}
        <Heading ctx={ctx} text={copy.MARITAL_STATUS} />
        {MARITAL.map((value) => (
          <Choice key={value} ctx={ctx} multiple label={copy[value]} selected={accepted.includes(value)} onPress={() => setAccepted(toggle(accepted, value))} testID={`qandeel-introductions-accept-${value}`} />
        ))}
        <Heading ctx={ctx} text={copy.AREA} />
        {Object.keys(AREA_COUNTRIES).sort((a, b) => areaName(a, ctx.language).localeCompare(areaName(b, ctx.language), ctx.language)).map((code) => (
          <Choice key={code} ctx={ctx} label={areaName(code, ctx.language)} selected={country === code}
            onPress={() => { setCountry(country === code ? null : code); setRegions([]); }} testID={`qandeel-introductions-req-country-${code}`} />
        ))}
        {country === null ? null : regionsOf(country).map((code) => (
          <Choice key={code} ctx={ctx} multiple label={areaName(code, ctx.language)} selected={regions.includes(code)} onPress={() => setRegions(toggle(regions, code))} testID={`qandeel-introductions-req-region-${code}`} />
        ))}
        <Action ctx={ctx} label={copy.save} primary disabled={items.length === 0 || !ageValid}
          onPress={() => onSave({ strength, answer: 'ITEMS', items })} testID="qandeel-introductions-save" />
      </>)}
      {onCancel === null ? null : <Action ctx={ctx} label={copy.cancel} onPress={onCancel} testID="qandeel-introductions-cancel" />}
    </View>
  );
}

function ProfileEditor({ ctx, copy, draft, onSave, onCancel, show }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly draft: IntroductionsDraft | null;
  readonly onSave: (payload: Record<string, unknown>) => void; readonly onCancel: (() => void) | null; readonly show: 'SHORT_INTRODUCTION' | 'WORK_FIELD' | 'BOTH';
}) {
  const [intro, setIntro] = useState(draft?.profile.shortIntroduction ?? '');
  const workField = draft?.profile.workField ?? null;
  const trimmed = intro.trim();
  const introValid = trimmed.length === 0 || (trimmed.length >= 20 && trimmed.length <= 280);
  return (
    <View testID="qandeel-introductions-profile">
      {show !== 'WORK_FIELD' ? (<>
        <Question ctx={ctx} text={copy.shortIntroTitle} testID="qandeel-introductions-step-heading" />
        <Para ctx={ctx} text={copy.shortIntroHint} role="supporting" color={ctx.palette.secondary} />
        <Field ctx={ctx} label={copy.shortIntroTitle} value={intro} onChange={setIntro} testID="qandeel-introductions-short-intro" maxLength={280} multiline />
        <Action ctx={ctx} label={copy.save} primary disabled={trimmed.length === 0 || !introValid}
          onPress={() => onSave({ shortIntroduction: trimmed, workField })} testID="qandeel-introductions-save" />
      </>) : null}
      {show !== 'SHORT_INTRODUCTION' ? (<>
        {show === 'WORK_FIELD' ? <Question ctx={ctx} text={copy.workFieldTitle} testID="qandeel-introductions-step-heading" /> : <Heading ctx={ctx} text={copy.workFieldTitle} />}
        {Object.keys(WORK_FIELD_NAMES).map((code) => (
          <Choice key={code} ctx={ctx} label={WORK_FIELD_NAMES[code][ctx.language]} selected={workField === code}
            onPress={() => onSave({ shortIntroduction: draft?.profile.shortIntroduction ?? null, workField: code })} testID={`qandeel-introductions-work-${code}`} />
        ))}
      </>) : null}
      {onCancel === null ? null : <Action ctx={ctx} label={copy.cancel} onPress={onCancel} testID="qandeel-introductions-cancel" />}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------------------------
// The details of one part of the review, disclosed by its Edit: every value with its own Edit (R3).

function PartDetails({ ctx, copy, draft, group, onEdit }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly draft: IntroductionsDraft; readonly group: PortraitGroup;
  readonly onEdit: (editing: Editing) => void;
}) {
  const sheet: PartContext = { ...ctx, onSheet: true };
  const row = (key: string, label: string, value: string, edit: Editing) => (
    <View key={key} testID={`qandeel-introductions-summary-${key}`} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, minHeight: 56, paddingStart: 16, paddingEnd: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, writingDirection: ctx.writing }}>{label}</Text>
        <Text style={{ ...typeStyle('body'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{value}</Text>
      </View>
      <Action ctx={sheet} inline label={copy.edit} accessibilityLabel={`${copy.edit}: ${label}`} onPress={() => onEdit(edit)} testID={`qandeel-introductions-edit-${key}`} />
    </View>
  );
  const requirementLine = (side: IntroductionsDraft['requirements']['hard'] | IntroductionsDraft['requirements']['soft'], none: string) =>
    side.answer === null ? copy.notSet : side.answer === 'ITEMS'
      ? side.items.map((i) => { const w = requirementWords(i, copy, ctx.language); return `${w.label}: ${w.value}`; }).join(ctx.language === 'ar' ? '؛ ' : '; ') : none;
  const facts: IntroductionsFact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];
  return (
    <View testID={`qandeel-introductions-details-${group}`} style={{ marginTop: 8, borderRadius: 16, backgroundColor: ctx.palette.field, paddingVertical: 4 }}>
      {group === 'ABOUT' ? (<>
        {facts.map((fact) => row(fact, factTitle(fact, copy), factValue(draft, fact, copy, ctx.language) ?? copy.notSet, { kind: 'FACT', fact }))}
        {row('WORK', copy.workFieldTitle, draft.profile.workField === null ? copy.stateNotIncluded : WORK_FIELD_NAMES[draft.profile.workField]?.[ctx.language] ?? copy.notSet, { kind: 'PROFILE' })}
        {row('PROFILE', copy.shortIntroTitle, draft.profile.shortIntroduction ?? copy.stateNotIncluded, { kind: 'PROFILE' })}
      </>) : (<>
        {row('HARD', copy.hardTitle, requirementLine(draft.requirements.hard, copy.hardNone), { kind: 'HARD' })}
        {row('SOFT', copy.softTitle, requirementLine(draft.requirements.soft, copy.softNone), { kind: 'SOFT' })}
      </>)}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------------------------

export function IntroductionsSurface({ controller, language, insets, onBack }: IntroductionsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const copy = introductionsCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const headingRef = useRef<Text | null>(null);
  const onHeading = useCallback((node: Text | null) => { headingRef.current = node; }, []);
  const ctx: PartContext = { palette, language, writing, busy: state.busy, onHeading };
  const sheetCtx: PartContext = { ...ctx, onSheet: true };
  const view = state.view;
  const draft = view?.draft ?? null;
  const [started, setStarted] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [note, setNote] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openPart, setOpenPart] = useState<PortraitGroup | null>(null);
  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [landed, setLanded] = useState<ReadonlySet<string>>(NONE);
  const [arrivalTick, setArrivalTick] = useState(0);

  const portrait: Portrait | null = view === null ? null : projectPortrait(view, copy, language);
  // The portrait the owner was shown when they acted: an arrival is what the server's answer added to it.
  const portraitRef = useRef<Portrait | null>(null);
  useEffect(() => {
    portraitRef.current = portrait;
  });

  useEffect(() => {
    controller.open();
  }, [controller]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Android system Back inside an editor or an opened part leaves it, and nothing else.
  const local = editing !== null || correcting !== null || confirmDiscard || openPart !== null;
  // Memoization is the React Compiler's (no manual useCallback that it could not preserve).
  const leaveLocal = () => {
    setEditing(null);
    setCorrecting(null);
    setConfirmDiscard(false);
    setOpenPart(null);
  };
  useEffect(() => {
    if (!local) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setEditing(null);
      setCorrecting(null);
      setConfirmDiscard(false);
      setOpenPart(null);
      return true;
    });
    return () => subscription.remove();
  }, [local]);

  const send = async (kind: Parameters<IntroductionsController['command']>[0], payload: Record<string, unknown>) => {
    const before = portraitRef.current;
    setLanded(NONE);
    // Sending an answer closes the keyboard while its field still exists (dismissing blurs the focused field, and the
    // server's answer may replace the step): the next step — a confirmation, a choice — is never left beneath it.
    Keyboard.dismiss();
    const ok = await controller.command(kind, payload);
    if (ok) {
      setEditing(null);
      setCorrecting(null);
      setCorrection('');
      setNote('');
      // What this server-confirmed change ADDED to the portrait — nothing is shown arriving before the server applied it.
      const after = controller.getState().view;
      const added = after === null ? NONE : arrivals(before, projectPortrait(after, introductionsCopy(language), language));
      setLanded(added);
      if (added.size > 0) setArrivalTick((t) => t + 1);
    }
    return ok;
  };

  const next = view?.plan.next ?? null;
  const stepKey = editing !== null ? `edit-${editing.kind}-${'fact' in editing ? editing.fact : ''}`
    : next === null ? `stage-${view?.plan.stage ?? 'loading'}-${started}` : `${next.kind}-${'fact' in next ? next.fact : 'item' in next ? next.item.memoryId : ''}-${started}`;
  const titleRef = useRef<Text | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const contentRef = useRef<View | null>(null);
  const viewportHeight = useRef(0);
  const placeOnLayout = useRef(true);
  // Each step opens with its current item in view, a glimpse of the portrait above it: never the previous scroll position.
  useEffect(() => {
    placeOnLayout.current = true;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stepKey]);
  const placeActive = (y: number) => {
    if (!placeOnLayout.current) return;
    placeOnLayout.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - viewportHeight.current * PORTRAIT_GLIMPSE), animated: false });
  };
  // With the keyboard up, the field being typed in comes into view with its question above it and its act below it.
  useEffect(() => {
    if (!keyboard) return;
    const input = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!input || !content) return;
    input.measureLayout(content, (_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - Math.min(FIELD_CONTEXT, viewportHeight.current * 0.3)), animated: !reduceMotion });
    }, () => undefined);
  }, [keyboard, reduceMotion]);
  // The screen reader arrives on the step's question (or the page title) once per step; a confirmation is announced
  // after it, whether or not anything is shown moving.
  useEffect(() => {
    if (!ready) return;
    const target = headingRef.current ?? titleRef.current;
    const node = target === null ? null : findNodeHandle(target);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, stepKey]);
  useEffect(() => {
    if (arrivalTick === 0) return;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(copy.added, { queue: true });
    else AccessibilityInfo.announceForAccessibility(copy.added);
  }, [arrivalTick, copy.added]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={INTRODUCTIONS_SURFACE_TEST_ID} />;

  const notice = state.notice === null ? null : ({
    CHANGED_ELSEWHERE: copy.changedElsewhere, UNAVAILABLE: copy.unavailable, DELETION_PENDING: copy.deletionPending,
    NOTE_LIMIT: copy.noteLimit, FAILED: copy.failed, INVALID: copy.invalid,
  })[state.notice];

  const pathLine = view === null ? null : view.plan.path === 'KNOWN' ? copy.pathKnown : view.plan.path === 'MIXED' ? copy.pathMixed : copy.pathNew;
  const readOnly = view !== null && (!view.availability.preparation || view.accountDeletionPending);
  const roomy = windowHeight / Math.max(1, fontScale) >= ROOMY_HEIGHT;
  const expanded = !keyboard && (expandedChoice ?? roomy);

  const sheet = (children: ReactNode, onLayout = true) => (
    <View
      testID="qandeel-introductions-sheet"
      onLayout={onLayout ? (e) => placeActive(e.nativeEvent.layout.y) : undefined}
      style={{ backgroundColor: palette.field, borderTopStartRadius: SHEET_RADIUS, borderTopEndRadius: SHEET_RADIUS, paddingTop: 14, paddingBottom: insets.bottom + 16, marginTop: 8 }}
    >
      {children}
    </View>
  );
  const composed = (p: Portrait, editable: boolean) => (
    <LivingPortrait ctx={ctx} copy={copy} portrait={p} mode="COMPOSED" landed={landed} reduceMotion={reduceMotion}
      edit={!editable || draft === null ? undefined : {
        open: openPart, onEdit: (g) => setOpenPart(openPart === g ? null : g),
        details: openPart === null ? null : <PartDetails ctx={ctx} copy={copy} draft={draft} group={openPart} onEdit={(e) => { setOpenPart(null); setEditing(e); }} />,
      }} />
  );

  // World (what is settled) · the band (what the current step is about) · the sheet (the current act).
  let world: ReactNode = null;
  let band: ReactNode = null;
  let act: ReactNode = null;
  if (state.status === 'UNAVAILABLE' && view === null) {
    world = (
      <View testID="qandeel-introductions-unavailable">
        <Para ctx={ctx} text={copy.unavailable} color={palette.error} />
        <Action ctx={ctx} label={copy.tryAgain} onPress={() => controller.open()} testID="qandeel-introductions-retry" />
      </View>
    );
  } else if (view !== null && portrait !== null && readOnly) {
    // Closed, or a deletion is pending: the owner may still see and delete what they prepared — nothing else.
    const unsettled = portrait.open.filter((item) => item.key.startsWith('fact:'));
    world = (
      <View testID="qandeel-introductions-read-only">
        <Para ctx={ctx} text={view.accountDeletionPending ? copy.deletionPending : copy.unavailable} color={palette.secondary} />
        {draft === null ? null : composed(portrait, false)}
        {unsettled.map((item) => (
          <View key={item.key} style={{ paddingTop: 12 }}>
            <OpenBand ctx={ctx} copy={copy} item={item} title={factTitle(item.key.slice(5) as IntroductionsFact, copy)} textTestID={`qandeel-introductions-open-${item.key}`} />
          </View>
        ))}
        {draft === null ? null : <DiscardBlock ctx={ctx} copy={copy} confirming={confirmDiscard} setConfirming={setConfirmDiscard} onDiscard={() => void controller.discard()} />}
      </View>
    );
  } else if (view !== null && editing !== null) {
    act = sheet(editing.kind === 'FACT'
      ? <FactEditor ctx={sheetCtx} copy={copy} fact={editing.fact} draft={draft} onSave={(p) => void send('SET_FACT', p)} onCancel={() => setEditing(null)} />
      : editing.kind === 'PROFILE'
        ? <ProfileEditor ctx={sheetCtx} copy={copy} draft={draft} show="BOTH" onSave={(p) => void send('SET_PROFILE', p)} onCancel={() => setEditing(null)} />
        : <RequirementsEditor ctx={sheetCtx} copy={copy} strength={editing.kind} draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={() => setEditing(null)} />);
  } else if (view !== null && draft === null && !started) {
    // The restrained beginning: nothing is drawn for what is not known yet (R1).
    world = (
      <View testID="qandeel-introductions-intro" style={{ paddingTop: 12 }}>
        <Question ctx={ctx} text={copy.opening} />
        <Para ctx={ctx} text={copy.privateNote} role="supporting" color={palette.secondary} />
      </View>
    );
    act = sheet(<>
      {pathLine === null ? null : <Para ctx={sheetCtx} text={pathLine} role="supporting" color={palette.secondary} testID="qandeel-introductions-path" />}
      <Action ctx={sheetCtx} label={copy.start} primary onPress={() => setStarted(true)} testID="qandeel-introductions-start" />
      <Para ctx={sheetCtx} text={copy.enrollmentUnavailable} role="metadata" color={palette.tertiary} testID="qandeel-introductions-enrollment-unavailable" />
    </>);
  } else if (view !== null && portrait !== null && next !== null && next.kind === 'REVIEW') {
    // The review's lead opens the screen (R2: on 320dp the portrait never pushes the question out of view); the
    // portrait it introduces follows, and the act that confirms it rests below.
    world = (
      <View testID="qandeel-introductions-step-REVIEW" style={{ paddingTop: 12 }}>
        <Question ctx={ctx} text={copy.reviewLead} testID="qandeel-introductions-step-heading" />
        {composed(portrait, true)}
      </View>
    );
    act = sheet(
      <>
        <Para ctx={sheetCtx} text={copy.enrollmentUnavailable} role="supporting" color={palette.secondary} testID="qandeel-introductions-enrollment-unavailable" />
        <Action ctx={sheetCtx} label={copy.reviewConfirm} primary onPress={() => void send('CONFIRM_REVIEW', {})} testID="qandeel-introductions-review-confirm" />
      </>,
      false,
    );
  } else if (view !== null && portrait !== null && next !== null) {
    const priorStep = next.kind === 'CONFIRM_PRIOR_ITEM' || next.kind === 'CLARIFY_PRIOR_ITEM';
    const showPath = pathLine !== null && ((priorStep && (draft?.notes.length ?? 0) === 0)
      || (next.kind === 'ESTABLISH_FACT' && next.fact === 'INTRODUCTION_FIRST_NAME' && draft?.facts.firstName == null && view.plan.path === 'NEW'));
    const current = portrait.current;
    world = (<>
      {showPath ? <View style={{ paddingTop: 12 }}><Para ctx={ctx} text={pathLine} role="supporting" color={palette.secondary} testID="qandeel-introductions-path" /></View> : null}
      {portraitIsEmpty(portrait) && current?.lands == null ? null : (
        <LivingPortrait ctx={ctx} copy={copy} portrait={portrait} mode={expanded ? 'EXPANDED' : 'COMPACT'} landed={landed} reduceMotion={reduceMotion}
          current={priorStep ? current : null} onToggle={() => setExpandedChoice(!expanded)} />
      )}
    </>);
    if (current !== null && next.kind !== 'RESOLVE_DISCREPANCY') {
      const clarify = next.kind === 'CLARIFY_PRIOR_ITEM';
      band = (
        <View onLayout={(e) => placeActive(e.nativeEvent.layout.y)}>
          <OpenBand ctx={ctx} copy={copy} item={current}
            lead={priorStep ? (clarify ? copy.priorClarifyLead : copy.priorLead) : null}
            title={priorStep ? null : factTitle((next as { fact: IntroductionsFact }).fact, copy)}
            textTestID={priorStep ? 'qandeel-introductions-prior-words' : 'qandeel-introductions-fact-value'}
            trailing={priorStep && correcting === null
              ? <Action ctx={ctx} inline label={copy.priorStop} onPress={() => void send('SKIP_STEP', { step: 'PRIOR_UNDERSTANDING' })} testID="qandeel-introductions-prior-stop" />
              : null} />
        </View>
      );
    }
    act = sheet(<Step ctx={sheetCtx} copy={copy} view={view} objective={next} send={send} controller={controller}
      correcting={correcting} setCorrecting={setCorrecting} correction={correction} setCorrection={setCorrection}
      note={note} setNote={setNote} onEdit={setEditing} />, band === null);
  } else if (view !== null && portrait !== null && draft !== null) {
    // The private preparation, complete — and plainly not enrollment: said first (R3), before the portrait it completes.
    world = (
      <View testID="qandeel-introductions-reviewed" style={{ paddingTop: 12 }}>
        <Para ctx={ctx} text={copy.reviewed} role="supporting" color={palette.secondary} testID="qandeel-introductions-enrollment-unavailable" />
        {composed(portrait, true)}
        <AssistanceRow ctx={ctx} copy={copy} view={view} controller={controller} />
        <DiscardBlock ctx={ctx} copy={copy} confirming={confirmDiscard} setConfirming={setConfirmDiscard} onDiscard={() => void controller.discard()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      testID={INTRODUCTIONS_SURFACE_TEST_ID}
      // The sheet's field and act stay above the keyboard (Android 15+ is edge-to-edge and no longer resizes the window).
      behavior="padding"
      accessibilityLanguage={language}
      style={{ flex: 1, backgroundColor: palette.world, direction: writing }}
    >
      <AppearanceStatusBar />
      <View
        style={{
          paddingTop: insets.top,
          paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10,
          paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
          minHeight: insets.top + HEADER_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 2,
        }}
      >
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.back}
          onPress={local ? leaveLocal : onBack}
          testID="qandeel-introductions-back"
          style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}
        >
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text
          ref={titleRef}
          testID="qandeel-introductions-title"
          accessibilityRole="header"
          accessibilityLanguage={language}
          style={{ ...LOCAL_TYPE.header, color: palette.primary, flexShrink: 1, paddingHorizontal: 2, writingDirection: writing }}
        >
          {copy.name}
        </Text>
      </View>
      <View testID="qandeel-introductions-notice" accessibilityLiveRegion="polite">
        {notice === null ? null : <Para ctx={ctx} text={notice} role="supporting" color={state.notice === 'CHANGED_ELSEWHERE' ? palette.secondary : palette.error} />}
      </View>
      <ScrollView
        ref={scrollRef}
        testID="qandeel-introductions-body"
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => { viewportHeight.current = e.nativeEvent.layout.height; }}
        // Delete preparation is the page's last block: its confirmation opens in view, never below the fold.
        onContentSizeChange={() => { if (confirmDiscard) scrollRef.current?.scrollToEnd({ animated: !reduceMotion }); }}
        contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: act === null ? insets.bottom + 16 : 0 }}
      >
        <View ref={contentRef} style={{ flexGrow: 1 }}>
          {world}
          {/* The sheet rests at the bottom of a short page; a long one simply scrolls. */}
          <View style={{ flexGrow: 1, minHeight: act === null ? 0 : 16 }} />
          {band}
          {act}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DiscardBlock({ ctx, copy, confirming, setConfirming, onDiscard }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly confirming: boolean; readonly setConfirming: (v: boolean) => void; readonly onDiscard: () => void;
}) {
  return (
    <View testID="qandeel-introductions-discard-block" style={{ paddingTop: 12 }}>
      {confirming ? (<>
        <Para ctx={ctx} text={copy.discardConfirm} color={ctx.palette.error} />
        <Action ctx={ctx} label={copy.discardYes} onPress={onDiscard} testID="qandeel-introductions-discard-confirm" />
        <Action ctx={ctx} label={copy.cancel} onPress={() => setConfirming(false)} testID="qandeel-introductions-discard-cancel" />
      </>) : (
        <Action ctx={ctx} label={copy.discard} onPress={() => setConfirming(true)} testID="qandeel-introductions-discard" />
      )}
    </View>
  );
}

function AssistanceRow({ ctx, copy, view, controller }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly view: IntroductionsView; readonly controller: IntroductionsController;
}) {
  if (!view.availability.assistance && view.assistance.consent === 'NOT_GRANTED') return null;
  const granted = view.assistance.consent === 'GRANTED';
  return (
    <View testID="qandeel-introductions-assistance" style={{ paddingTop: 12 }}>
      <Para ctx={ctx} text={granted ? copy.assistanceOn : copy.assistanceOff} role="metadata" color={ctx.palette.tertiary} />
      {granted
        ? <Action ctx={ctx} label={copy.stopAssistance} onPress={() => void controller.revokeAssistance()} testID="qandeel-introductions-assistance-revoke" />
        : <Action ctx={ctx} label={copy.allowAssistance} onPress={() => void controller.grantAssistance()} testID="qandeel-introductions-assistance-grant" />}
    </View>
  );
}

/** The current act, on the sheet. What it is about (a remembered item, a value to confirm) is in the band above it. */
function Step({ ctx, copy, view, objective, send, controller, correcting, setCorrecting, correction, setCorrection, note, setNote, onEdit }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly view: IntroductionsView; readonly objective: IntroductionsObjective;
  readonly send: (kind: Parameters<IntroductionsController['command']>[0], payload: Record<string, unknown>) => Promise<boolean>;
  readonly controller: IntroductionsController;
  readonly correcting: string | null; readonly setCorrecting: (id: string | null) => void;
  readonly correction: string; readonly setCorrection: (t: string) => void;
  readonly note: string; readonly setNote: (t: string) => void; readonly onEdit: (editing: Editing) => void;
}) {
  const draft = view.draft;
  switch (objective.kind) {
    case 'OFFER_ASSISTANCE': {
      const text = view.assistance.currentVersion === null ? null : ASSISTANCE_CONSENT_TEXT[view.assistance.currentVersion]?.[ctx.language] ?? null;
      // Two equal acts: permission is never nudged.
      return (
        <View testID="qandeel-introductions-step-OFFER_ASSISTANCE">
          <Question ctx={ctx} text={copy.assistanceOfferTitle} testID="qandeel-introductions-step-heading" />
          {text === null ? null : <Para ctx={ctx} text={text} role="supporting" testID="qandeel-introductions-consent-text" />}
          <Action ctx={ctx} label={copy.allowAssistance} disabled={text === null} onPress={() => void controller.grantAssistance()} testID="qandeel-introductions-assistance-grant" />
          <Action ctx={ctx} label={copy.continueWithout} onPress={() => void send('SKIP_STEP', { step: 'ASSISTANCE_OFFER' })} testID="qandeel-introductions-assistance-decline" />
        </View>
      );
    }
    case 'CONFIRM_PRIOR_ITEM':
    case 'CLARIFY_PRIOR_ITEM': {
      const { item } = objective;
      const clarify = objective.kind === 'CLARIFY_PRIOR_ITEM';
      const decide = (decision: string, extra: Record<string, unknown> = {}) => void send('RECORD_PRIOR_UNDERSTANDING', { memoryId: item.memoryId, decision, ...extra });
      return (
        <View testID={`qandeel-introductions-step-${objective.kind}`}>
          {correcting === item.memoryId ? (<>
            <Question ctx={ctx} text={copy.priorEdit} testID="qandeel-introductions-step-heading" />
            <Field ctx={ctx} label={copy.priorCorrectionLabel} value={correction} onChange={setCorrection} testID="qandeel-introductions-prior-correction" maxLength={500} multiline />
            <Action ctx={ctx} label={copy.save} primary disabled={correction.trim().length < 2} onPress={() => decide('CORRECTED', { correctedBody: correction.trim() })} testID="qandeel-introductions-save" />
            <Action ctx={ctx} label={copy.cancel} onPress={() => setCorrecting(null)} testID="qandeel-introductions-cancel" />
          </>) : (<>
            <Question ctx={ctx} text={clarify ? copy.priorClarifyQuestion : copy.priorConfirmQuestion} testID="qandeel-introductions-step-heading" />
            <Action ctx={ctx} label={copy.priorYes} primary onPress={() => decide('CONFIRMED')} testID="qandeel-introductions-prior-yes" />
            <ActionRow>
              <Action ctx={ctx} inline label={copy.priorEdit} onPress={() => { setCorrection(item.words); setCorrecting(item.memoryId); }} testID="qandeel-introductions-prior-edit" />
              <Action ctx={ctx} inline label={copy.priorNoLonger} onPress={() => decide('NO_LONGER_ACCURATE')} testID="qandeel-introductions-prior-no-longer" />
              <Action ctx={ctx} inline label={copy.priorDecline} onPress={() => decide('DECLINED')} testID="qandeel-introductions-prior-decline" />
            </ActionRow>
            <Para ctx={ctx} text={copy.priorMemoryNote} role="metadata" color={ctx.palette.tertiary} testID="qandeel-introductions-prior-note" />
          </>)}
        </View>
      );
    }
    case 'ESTABLISH_FACT':
      return (
        <View testID={`qandeel-introductions-step-ESTABLISH_FACT-${objective.fact}`}>
          <FactEditor ctx={ctx} copy={copy} fact={objective.fact} draft={draft} onSave={(p) => void send('SET_FACT', p)} onCancel={null} />
        </View>
      );
    case 'CONFIRM_DECLARED_FACT':
    case 'RECONFIRM_CORRECTED_FACT': {
      const question = objective.kind === 'RECONFIRM_CORRECTED_FACT' ? copy.factReconfirm : objective.fact === 'SEX' ? copy.sexConfirmQuestion : copy.factConfirmQuestion;
      return (
        <View testID={`qandeel-introductions-step-${objective.kind}-${objective.fact}`}>
          <Question ctx={ctx} text={question} testID="qandeel-introductions-step-heading" />
          <Action ctx={ctx} label={copy.yesCorrect} primary onPress={() => void send('CONFIRM_FACT', { fact: objective.fact })} testID="qandeel-introductions-confirm" />
          <ActionRow>
            <Action ctx={ctx} inline label={copy.edit} accessibilityLabel={`${copy.edit}: ${factTitle(objective.fact, copy)}`} onPress={() => onEdit({ kind: 'FACT', fact: objective.fact })} testID="qandeel-introductions-edit" />
          </ActionRow>
        </View>
      );
    }
    case 'RESOLVE_DISCREPANCY':
      return (
        <View testID="qandeel-introductions-step-RESOLVE_DISCREPANCY">
          <Question ctx={ctx} text={copy.discrepancyTitle} testID="qandeel-introductions-step-heading" />
          <Para ctx={ctx} text={`${copy.discrepancyBody} ${objective.dimensions.map((d) => copy[d]).join(ctx.language === 'ar' ? '، ' : ', ')}`} />
          <ActionRow>
            <Action ctx={ctx} inline label={copy.editHard} onPress={() => onEdit({ kind: 'HARD' })} testID="qandeel-introductions-edit-hard" />
            <Action ctx={ctx} inline label={copy.editSoft} onPress={() => onEdit({ kind: 'SOFT' })} testID="qandeel-introductions-edit-soft" />
          </ActionRow>
        </View>
      );
    case 'ESTABLISH_HARD_REQUIREMENTS':
      return <RequirementsEditor ctx={ctx} copy={copy} strength="HARD" draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={null} />;
    case 'ESTABLISH_SOFT_PREFERENCES':
      return <RequirementsEditor ctx={ctx} copy={copy} strength="SOFT" draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={null} />;
    case 'ESTABLISH_PRIORITIES':
      return (
        <View testID="qandeel-introductions-step-ESTABLISH_PRIORITIES">
          <Question ctx={ctx} text={copy.prioritiesTitle} testID="qandeel-introductions-step-heading" />
          <Para ctx={ctx} text={copy.prioritiesHint} role="supporting" color={ctx.palette.secondary} />
          <Field ctx={ctx} label={copy.prioritiesTitle} value={note} onChange={setNote} testID="qandeel-introductions-priority" maxLength={500} multiline />
          <Action ctx={ctx} label={copy.save} primary disabled={note.trim().length < 2} onPress={() => void send('ADD_NOTE', { kind: 'WHAT_MATTERS', body: note.trim() })} testID="qandeel-introductions-save" />
          <Action ctx={ctx} label={copy.skip} onPress={() => void send('SKIP_STEP', { step: 'NOTES' })} testID="qandeel-introductions-skip" />
        </View>
      );
    case 'OFFER_SHORT_INTRODUCTION':
    case 'OFFER_WORK_FIELD':
      return (
        <View testID={`qandeel-introductions-step-${objective.kind}`}>
          <ProfileEditor ctx={ctx} copy={copy} draft={draft} show={objective.kind === 'OFFER_WORK_FIELD' ? 'WORK_FIELD' : 'SHORT_INTRODUCTION'}
            onSave={(p) => void send('SET_PROFILE', p)} onCancel={null} />
          <Action ctx={ctx} label={copy.skip} onPress={() => void send('SKIP_STEP', { step: objective.kind === 'OFFER_WORK_FIELD' ? 'WORK_FIELD' : 'SHORT_INTRODUCTION' })} testID="qandeel-introductions-skip" />
        </View>
      );
    default:
      return null;
  }
}
