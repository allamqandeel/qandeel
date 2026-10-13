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
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionsDraft, IntroductionsFact, IntroductionsObjective, IntroductionsRequirementItem, IntroductionsView } from '../runtime-entry';
import { AREA_COUNTRIES, areaName, regionsOf } from './area-catalogue';
import { ASSISTANCE_CONSENT_TEXT, MONTHS, WORK_FIELD_NAMES, introductionsCopy, type IntroductionsCopy } from './copy';
import type { IntroductionsController } from './introductions-controller';
import { Action, Choice, Field, Heading, Para, Quote, type PartContext } from './IntroductionsParts';

export const INTRODUCTIONS_SURFACE_TEST_ID = 'qandeel-introductions';

export interface IntroductionsSurfaceProps {
  readonly controller: IntroductionsController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** Back to the Personal world, exactly as it was. */
  readonly onBack: () => void;
}

const HEADER_MIN_HEIGHT = 48;
const MARITAL = ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED'] as const;

type Editing = { readonly kind: 'FACT'; readonly fact: IntroductionsFact } | { readonly kind: 'HARD' | 'SOFT' | 'PROFILE' } | null;

// ------------------------------------------------------------------------------------------------------------------
// Values in words.

function factValue(draft: IntroductionsDraft | null, fact: IntroductionsFact, copy: IntroductionsCopy, language: ChromeLanguage): string | null {
  const f = draft?.facts;
  if (!f) return null;
  switch (fact) {
    case 'INTRODUCTION_FIRST_NAME': return f.firstName?.value ?? null;
    case 'SEX': return f.sex === null ? null : f.sex.value === 'MALE' ? copy.male : copy.female;
    case 'BIRTH_YEAR_MONTH': return f.birthYearMonth === null ? null : `${MONTHS[language][f.birthYearMonth.month - 1]} ${f.birthYearMonth.year}`;
    case 'BROAD_AREA': return f.area === null ? null
      : f.area.regionCode === null ? areaName(f.area.countryCode, language) : `${areaName(f.area.regionCode, language)}${language === 'ar' ? '، ' : ', '}${areaName(f.area.countryCode, language)}`;
    default: return f.maritalStatus === null ? null : copy[f.maritalStatus.value as (typeof MARITAL)[number]];
  }
}
const factTitle = (fact: IntroductionsFact, copy: IntroductionsCopy) => ({
  INTRODUCTION_FIRST_NAME: copy.firstNameTitle, SEX: copy.sexTitle, BIRTH_YEAR_MONTH: copy.birthTitle, BROAD_AREA: copy.areaTitle, MARITAL_STATUS: copy.maritalTitle,
})[fact];

function itemWords(item: IntroductionsRequirementItem, copy: IntroductionsCopy, language: ChromeLanguage): string {
  if (item.dimension === 'AGE_RANGE') return `${copy.AGE_RANGE}: ${copy.ageRange.replace('{min}', String(item.min)).replace('{max}', String(item.max))}`;
  if (item.dimension === 'MARITAL_STATUS') return `${copy.MARITAL_STATUS}: ${(item.accepted ?? []).map((v) => copy[v as (typeof MARITAL)[number]]).join(language === 'ar' ? '، ' : ', ')}`;
  const regions = item.regionCodes?.map((r) => areaName(r, language)).join(language === 'ar' ? '، ' : ', ');
  return `${copy.AREA}: ${areaName(item.countryCode ?? '', language)}${regions ? ` (${regions})` : ''}`;
}

// ------------------------------------------------------------------------------------------------------------------
// Editors.

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
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.secondary, paddingTop: 6, paddingStart: 24, paddingEnd: 20, writingDirection: ctx.writing }}>{copy.birthMonth}</Text>
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
  return <View testID={`qandeel-introductions-edit-${fact}`}><Heading ctx={ctx} text={title} testID="qandeel-introductions-step-heading" />{body}{cancel}</View>;
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
      <Heading ctx={ctx} text={title} testID="qandeel-introductions-step-heading" />
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
        <Heading ctx={ctx} text={copy.shortIntroTitle} testID="qandeel-introductions-step-heading" />
        <Para ctx={ctx} text={copy.shortIntroHint} role="supporting" color={ctx.palette.secondary} />
        <Field ctx={ctx} label={copy.shortIntroTitle} value={intro} onChange={setIntro} testID="qandeel-introductions-short-intro" maxLength={280} multiline />
        <Action ctx={ctx} label={copy.save} primary disabled={trimmed.length === 0 || !introValid}
          onPress={() => onSave({ shortIntroduction: trimmed, workField })} testID="qandeel-introductions-save" />
      </>) : null}
      {show !== 'SHORT_INTRODUCTION' ? (<>
        <Heading ctx={ctx} text={copy.workFieldTitle} testID={show === 'WORK_FIELD' ? 'qandeel-introductions-step-heading' : undefined} />
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
// The review: what the owner prepared, every part editable.

function Summary({ ctx, copy, draft, editable, onEdit }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly draft: IntroductionsDraft;
  readonly editable: boolean; readonly onEdit: (editing: Editing) => void;
}) {
  const facts: IntroductionsFact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];
  const row = (key: string, label: string, value: string, edit: Editing) => (
    <View key={key} testID={`qandeel-introductions-summary-${key}`} style={{ paddingTop: 6 }}>
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, paddingStart: 24, paddingEnd: 20, writingDirection: ctx.writing }}>{label}</Text>
      <Text style={{ ...typeStyle('body'), color: ctx.palette.primary, paddingStart: 24, paddingEnd: 20, writingDirection: ctx.writing }}>{value}</Text>
      {editable ? <Action ctx={ctx} label={copy.edit} accessibilityLabel={`${copy.edit}: ${label}`} onPress={() => onEdit(edit)} testID={`qandeel-introductions-edit-${key}`} /> : null}
    </View>
  );
  const requirementLine = (side: { readonly answer: string | null; readonly items: readonly IntroductionsRequirementItem[] }, none: string) =>
    side.answer === null ? copy.notSet : side.answer === 'ITEMS' ? side.items.map((i) => itemWords(i, copy, ctx.language)).join(ctx.language === 'ar' ? '؛ ' : '; ') : none;
  return (
    <View testID="qandeel-introductions-summary">
      {facts.map((fact) => row(fact, factTitle(fact, copy), factValue(draft, fact, copy, ctx.language) ?? copy.notSet, { kind: 'FACT', fact }))}
      {row('HARD', copy.hardTitle, requirementLine(draft.requirements.hard, copy.hardNone), { kind: 'HARD' })}
      {row('SOFT', copy.softTitle, requirementLine(draft.requirements.soft, copy.softNone), { kind: 'SOFT' })}
      {row('PROFILE', copy.shortIntroTitle, draft.profile.shortIntroduction ?? copy.notSet, { kind: 'PROFILE' })}
      {row('WORK', copy.workFieldTitle, draft.profile.workField === null ? copy.notSet : WORK_FIELD_NAMES[draft.profile.workField]?.[ctx.language] ?? copy.notSet, { kind: 'PROFILE' })}
      {draft.notes.length === 0 ? null : (<>
        <Heading ctx={ctx} text={copy.notesHeading} />
        {draft.notes.map((note) => <Quote key={note.id} ctx={ctx} text={note.body} testID={`qandeel-introductions-note-${note.id}`} />)}
      </>)}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------------------------

export function IntroductionsSurface({ controller, language, insets, onBack }: IntroductionsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = introductionsCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const ctx: PartContext = { palette, language, writing, busy: state.busy };
  const view = state.view;
  const draft = view?.draft ?? null;
  const [started, setStarted] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [note, setNote] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    controller.open();
  }, [controller]);

  // Android system Back inside an editor leaves the editor, and nothing else.
  const local = editing !== null || correcting !== null || confirmDiscard;
  const leaveLocal = useCallback(() => {
    setEditing(null);
    setCorrecting(null);
    setConfirmDiscard(false);
  }, []);
  useEffect(() => {
    if (!local) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveLocal();
      return true;
    });
    return () => subscription.remove();
  }, [local, leaveLocal]);

  const send = useCallback(async (kind: Parameters<IntroductionsController['command']>[0], payload: Record<string, unknown>) => {
    const ok = await controller.command(kind, payload);
    if (ok) {
      setEditing(null);
      setCorrecting(null);
      setCorrection('');
      setNote('');
    }
    return ok;
  }, [controller]);

  const next = view?.plan.next ?? null;
  const stepKey = editing !== null ? `edit-${editing.kind}-${'fact' in editing ? editing.fact : ''}`
    : next === null ? `stage-${view?.plan.stage ?? 'loading'}` : `${next.kind}-${'fact' in next ? next.fact : 'item' in next ? next.item.memoryId : ''}`;
  // The screen reader arrives on the step's heading (or the page title) once per step.
  const titleRef = useRef<Text | null>(null);
  // Each step opens at its top: a new step never inherits the previous one's scroll position.
  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stepKey]);
  useEffect(() => {
    if (!ready) return;
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, stepKey]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={INTRODUCTIONS_SURFACE_TEST_ID} />;

  const notice = state.notice === null ? null : ({
    CHANGED_ELSEWHERE: copy.changedElsewhere, UNAVAILABLE: copy.unavailable, DELETION_PENDING: copy.deletionPending,
    NOTE_LIMIT: copy.noteLimit, FAILED: copy.failed, INVALID: copy.invalid,
  })[state.notice];

  const pathLine = view === null ? null : view.plan.path === 'KNOWN' ? copy.pathKnown : view.plan.path === 'MIXED' ? copy.pathMixed : copy.pathNew;
  const readOnly = view !== null && (!view.availability.preparation || view.accountDeletionPending);

  let body: ReactNode = null;
  if (state.status === 'UNAVAILABLE' && view === null) {
    body = (
      <View testID="qandeel-introductions-unavailable">
        <Para ctx={ctx} text={copy.unavailable} color={palette.error} />
        <Action ctx={ctx} label={copy.tryAgain} onPress={() => controller.open()} testID="qandeel-introductions-retry" />
      </View>
    );
  } else if (view !== null && readOnly) {
    // Closed, or a deletion is pending: the owner may still see and delete what they prepared — nothing else.
    body = (
      <View testID="qandeel-introductions-read-only">
        <Para ctx={ctx} text={view.accountDeletionPending ? copy.deletionPending : copy.unavailable} color={palette.secondary} />
        {draft === null ? null : <Summary ctx={ctx} copy={copy} draft={draft} editable={false} onEdit={setEditing} />}
        {draft === null ? null : <DiscardBlock ctx={ctx} copy={copy} confirming={confirmDiscard} setConfirming={setConfirmDiscard} onDiscard={() => void controller.discard()} />}
      </View>
    );
  } else if (view !== null && editing !== null) {
    if (editing.kind === 'FACT') {
      body = <FactEditor ctx={ctx} copy={copy} fact={editing.fact} draft={draft} onSave={(p) => void send('SET_FACT', p)} onCancel={() => setEditing(null)} />;
    } else if (editing.kind === 'PROFILE') {
      body = <ProfileEditor ctx={ctx} copy={copy} draft={draft} show="BOTH" onSave={(p) => void send('SET_PROFILE', p)} onCancel={() => setEditing(null)} />;
    } else {
      body = <RequirementsEditor ctx={ctx} copy={copy} strength={editing.kind} draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={() => setEditing(null)} />;
    }
  } else if (view !== null && draft === null && !started) {
    body = (
      <View testID="qandeel-introductions-intro">
        <Para ctx={ctx} text={copy.opening} />
        <Para ctx={ctx} text={copy.privateNote} color={palette.secondary} />
        <Para ctx={ctx} text={copy.enrollmentUnavailable} color={palette.secondary} testID="qandeel-introductions-enrollment-unavailable" />
        {pathLine === null ? null : <Para ctx={ctx} text={pathLine} testID="qandeel-introductions-path" />}
        <Action ctx={ctx} label={copy.start} primary onPress={() => setStarted(true)} testID="qandeel-introductions-start" />
      </View>
    );
  } else if (view !== null && next !== null) {
    body = <Step ctx={ctx} copy={copy} view={view} objective={next} pathLine={pathLine} send={send} controller={controller}
      correcting={correcting} setCorrecting={setCorrecting} correction={correction} setCorrection={setCorrection}
      note={note} setNote={setNote} onEdit={setEditing} />;
  } else if (view !== null && draft !== null) {
    body = (
      <View testID="qandeel-introductions-reviewed">
        <Para ctx={ctx} text={copy.reviewed} testID="qandeel-introductions-enrollment-unavailable" />
        <Summary ctx={ctx} copy={copy} draft={draft} editable onEdit={setEditing} />
        <AssistanceRow ctx={ctx} copy={copy} view={view} controller={controller} />
        <DiscardBlock ctx={ctx} copy={copy} confirming={confirmDiscard} setConfirming={setConfirmDiscard} onDiscard={() => void controller.discard()} />
      </View>
    );
  }

  return (
    <View testID={INTRODUCTIONS_SURFACE_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
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
          style={{ ...typeStyle('statement'), color: palette.primary, flexShrink: 1, paddingHorizontal: 2, writingDirection: writing }}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}
      >
        {body}
      </ScrollView>
    </View>
  );
}

function DiscardBlock({ ctx, copy, confirming, setConfirming, onDiscard }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly confirming: boolean; readonly setConfirming: (v: boolean) => void; readonly onDiscard: () => void;
}) {
  return (
    <View testID="qandeel-introductions-discard-block" style={{ paddingTop: 20 }}>
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
      <Para ctx={ctx} text={granted ? copy.assistanceOn : copy.assistanceOff} role="supporting" color={ctx.palette.secondary} />
      {granted
        ? <Action ctx={ctx} label={copy.stopAssistance} onPress={() => void controller.revokeAssistance()} testID="qandeel-introductions-assistance-revoke" />
        : <Action ctx={ctx} label={copy.allowAssistance} onPress={() => void controller.grantAssistance()} testID="qandeel-introductions-assistance-grant" />}
    </View>
  );
}

function Step({ ctx, copy, view, objective, pathLine, send, controller, correcting, setCorrecting, correction, setCorrection, note, setNote, onEdit }: {
  readonly ctx: PartContext; readonly copy: IntroductionsCopy; readonly view: IntroductionsView; readonly objective: IntroductionsObjective;
  readonly pathLine: string | null; readonly send: (kind: Parameters<IntroductionsController['command']>[0], payload: Record<string, unknown>) => Promise<boolean>;
  readonly controller: IntroductionsController;
  readonly correcting: string | null; readonly setCorrecting: (id: string | null) => void;
  readonly correction: string; readonly setCorrection: (t: string) => void;
  readonly note: string; readonly setNote: (t: string) => void; readonly onEdit: (editing: Editing) => void;
}) {
  const draft = view.draft;
  switch (objective.kind) {
    case 'OFFER_ASSISTANCE': {
      const text = view.assistance.currentVersion === null ? null : ASSISTANCE_CONSENT_TEXT[view.assistance.currentVersion]?.[ctx.language] ?? null;
      return (
        <View testID="qandeel-introductions-step-OFFER_ASSISTANCE">
          <Heading ctx={ctx} text={copy.assistanceOfferTitle} testID="qandeel-introductions-step-heading" />
          {text === null ? null : <Para ctx={ctx} text={text} testID="qandeel-introductions-consent-text" />}
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
          {pathLine === null ? null : <Para ctx={ctx} text={pathLine} color={ctx.palette.secondary} testID="qandeel-introductions-path" />}
          <Heading ctx={ctx} text={clarify ? copy.priorClarifyLead : copy.priorLead} testID="qandeel-introductions-step-heading" />
          <Quote ctx={ctx} text={item.words} testID="qandeel-introductions-prior-words" />
          {correcting === item.memoryId ? (<>
            <Field ctx={ctx} label={copy.priorCorrectionLabel} value={correction} onChange={setCorrection} testID="qandeel-introductions-prior-correction" maxLength={500} multiline />
            <Action ctx={ctx} label={copy.save} primary disabled={correction.trim().length < 2} onPress={() => decide('CORRECTED', { correctedBody: correction.trim() })} testID="qandeel-introductions-save" />
            <Action ctx={ctx} label={copy.cancel} onPress={() => setCorrecting(null)} testID="qandeel-introductions-cancel" />
          </>) : (<>
            <Para ctx={ctx} text={clarify ? copy.priorClarifyQuestion : copy.priorConfirmQuestion} />
            <Action ctx={ctx} label={copy.priorYes} primary onPress={() => decide('CONFIRMED')} testID="qandeel-introductions-prior-yes" />
            <Action ctx={ctx} label={copy.priorEdit} onPress={() => { setCorrection(item.words); setCorrecting(item.memoryId); }} testID="qandeel-introductions-prior-edit" />
            <Action ctx={ctx} label={copy.priorNoLonger} onPress={() => decide('NO_LONGER_ACCURATE')} testID="qandeel-introductions-prior-no-longer" />
            <Action ctx={ctx} label={copy.priorDecline} onPress={() => decide('DECLINED')} testID="qandeel-introductions-prior-decline" />
            <Para ctx={ctx} text={copy.priorMemoryNote} role="supporting" color={ctx.palette.tertiary} />
            <Action ctx={ctx} label={copy.priorStop} onPress={() => void send('SKIP_STEP', { step: 'PRIOR_UNDERSTANDING' })} testID="qandeel-introductions-prior-stop" />
          </>)}
        </View>
      );
    }
    case 'ESTABLISH_FACT': {
      const first = objective.fact === 'INTRODUCTION_FIRST_NAME' && draft?.facts.firstName == null;
      return (
        <View testID={`qandeel-introductions-step-ESTABLISH_FACT-${objective.fact}`}>
          {first && pathLine !== null && view.plan.path === 'NEW' ? <Para ctx={ctx} text={pathLine} color={ctx.palette.secondary} testID="qandeel-introductions-path" /> : null}
          <FactEditor ctx={ctx} copy={copy} fact={objective.fact} draft={draft} onSave={(p) => void send('SET_FACT', p)} onCancel={null} />
        </View>
      );
    }
    case 'CONFIRM_DECLARED_FACT':
    case 'RECONFIRM_CORRECTED_FACT': {
      const value = factValue(draft, objective.fact, copy, ctx.language) ?? '';
      const question = objective.kind === 'RECONFIRM_CORRECTED_FACT' ? copy.factReconfirm : objective.fact === 'SEX' ? copy.sexConfirmQuestion : copy.factConfirmQuestion;
      return (
        <View testID={`qandeel-introductions-step-${objective.kind}-${objective.fact}`}>
          <Heading ctx={ctx} text={factTitle(objective.fact, copy)} testID="qandeel-introductions-step-heading" />
          <Quote ctx={ctx} text={value} testID="qandeel-introductions-fact-value" />
          <Para ctx={ctx} text={question} />
          <Action ctx={ctx} label={copy.yesCorrect} primary onPress={() => void send('CONFIRM_FACT', { fact: objective.fact })} testID="qandeel-introductions-confirm" />
          <Action ctx={ctx} label={copy.edit} onPress={() => onEdit({ kind: 'FACT', fact: objective.fact })} testID="qandeel-introductions-edit" />
        </View>
      );
    }
    case 'RESOLVE_DISCREPANCY':
      return (
        <View testID="qandeel-introductions-step-RESOLVE_DISCREPANCY">
          <Heading ctx={ctx} text={copy.discrepancyTitle} testID="qandeel-introductions-step-heading" />
          <Para ctx={ctx} text={`${copy.discrepancyBody} ${objective.dimensions.map((d) => copy[d]).join(ctx.language === 'ar' ? '، ' : ', ')}`} />
          <Action ctx={ctx} label={copy.editHard} onPress={() => onEdit({ kind: 'HARD' })} testID="qandeel-introductions-edit-hard" />
          <Action ctx={ctx} label={copy.editSoft} onPress={() => onEdit({ kind: 'SOFT' })} testID="qandeel-introductions-edit-soft" />
        </View>
      );
    case 'ESTABLISH_HARD_REQUIREMENTS':
      return <RequirementsEditor ctx={ctx} copy={copy} strength="HARD" draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={null} />;
    case 'ESTABLISH_SOFT_PREFERENCES':
      return <RequirementsEditor ctx={ctx} copy={copy} strength="SOFT" draft={draft} onSave={(p) => void send('SET_REQUIREMENTS', p)} onCancel={null} />;
    case 'ESTABLISH_PRIORITIES':
      return (
        <View testID="qandeel-introductions-step-ESTABLISH_PRIORITIES">
          <Heading ctx={ctx} text={copy.prioritiesTitle} testID="qandeel-introductions-step-heading" />
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
    case 'REVIEW':
      return (
        <View testID="qandeel-introductions-step-REVIEW">
          <Heading ctx={ctx} text={copy.reviewLead} testID="qandeel-introductions-step-heading" />
          {draft === null ? null : <Summary ctx={ctx} copy={copy} draft={draft} editable onEdit={onEdit} />}
          <Para ctx={ctx} text={copy.enrollmentUnavailable} color={ctx.palette.secondary} testID="qandeel-introductions-enrollment-unavailable" />
          <Action ctx={ctx} label={copy.reviewConfirm} primary onPress={() => void send('CONFIRM_REVIEW', {})} testID="qandeel-introductions-review-confirm" />
        </View>
      );
    default:
      return null;
  }
}
