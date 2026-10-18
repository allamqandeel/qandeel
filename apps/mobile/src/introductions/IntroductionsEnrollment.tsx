/**
 * S6-07 (CP3) — the closing step of «التعارف مع قنديل»: the governed enrollment (Q8(A), D-CP1-1 = B) and the reader's
 * three consents, each withdrawn on its own. Every word is an approved row of the CP3 Copy Gate (`./enrollment-copy`);
 * the consent texts are exactly the CURRENT texts the server returned, and an act names the version of each text the
 * reader was shown (agreeing is per version: a text that changed is shown again with nothing agreed).
 *
 *   - `EnrollmentStep`: ONE act at a time (`enrollmentOffer`) — ENROLL, CORRECTION, RESUME or RECONFIRM_CONSENT — with one
 *     separate row per consent it exercises, never one checkbox; the act is enabled only when every row is agreed.
 *     Nothing is offered while the gate is closed (production) or an account deletion is pending, and no optional
 *     profile field is ever asked for.
 *   - `ConsentControls`: one row per consent with its state; «سحب الموافقة» opens a confirmation that names what that one
 *     withdrawal does, and withdraws exactly that consent. Always available once enrolled, whatever the gate.
 *
 * The reader's own state only; nothing about anyone else is read or shown.
 */
import { useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle } from '../conversation';
import type { EnrollmentConsentKind, EnrollmentView, IntroductionsDraft } from '../runtime-entry';
import { sharedCopy } from '../shared-world/copy';
import { consentInForce, enrollmentOffer, hasConsentControls, type EnrollmentController, type EnrollmentOffer } from './enrollment-controller';
import { enrollmentCopy, type EnrollmentCopy } from './enrollment-copy';
import { Action, BUSY_OPACITY, Heading, Para, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';

const CARD_RADIUS = 16;
const ORDER: readonly EnrollmentConsentKind[] = ['participation', 'contextGrant', 'disclosureAuthority'];
const LABEL: Readonly<Record<EnrollmentConsentKind, keyof EnrollmentCopy>> = Object.freeze({
  participation: 'participationLabel', contextGrant: 'contextGrantLabel', disclosureAuthority: 'disclosureAuthorityLabel',
});
const WITHDRAW_BODY: Readonly<Record<EnrollmentConsentKind, keyof EnrollmentCopy>> = Object.freeze({
  participation: 'withdrawParticipation', contextGrant: 'withdrawContextGrant', disclosureAuthority: 'withdrawDisclosureAuthority',
});
const ACT_LABEL: Readonly<Record<EnrollmentOffer['kind'], keyof EnrollmentCopy>> = Object.freeze({
  ENROLL: 'enroll', CORRECTION: 'correct', RESUME: 'resume', RECONFIRM_CONSENT: 'reconfirm',
});

/**
 * Which "not available" sentence the preparation shows, now that enrollment exists: the S6-01 sentence while nothing is
 * known or the reader never enrolled and the gate is closed (production); EN-10 for an enrolled reader while the gate is
 * closed; none while enrollment is open (the step speaks).
 */
export function enrollmentAvailabilityLine(view: EnrollmentView | null): 'PREPARATION' | 'CLOSED' | null {
  if (view === null) return 'PREPARATION';
  if (view.available) return null;
  return view.enrollment === null ? 'PREPARATION' : 'CLOSED';
}

/** The sentence that stands where the enrollment step would be: the S6-01 one (its own approved text), EN-10, or none. */
export function EnrollmentAvailabilityLine({ ctx, availability, preparationText, role, color }: {
  readonly ctx: PartContext; readonly availability: 'PREPARATION' | 'CLOSED' | null; readonly preparationText: string;
  readonly role: 'supporting' | 'metadata'; readonly color: string;
}) {
  if (availability === 'PREPARATION') return <Para ctx={ctx} text={preparationText} role={role} color={color} testID="qandeel-introductions-enrollment-unavailable" />;
  if (availability === 'CLOSED') return <Para ctx={ctx} text={enrollmentCopy(ctx.language).closed} role={role} color={color} testID="qandeel-enrollment-closed" />;
  return null;
}

function Notice({ ctx, controller, copy }: { readonly ctx: PartContext; readonly controller: EnrollmentController; readonly copy: EnrollmentCopy }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return (
    <View testID="qandeel-enrollment-notice" accessibilityLiveRegion="polite">
      {state.running === 'ACT' ? <Para ctx={ctx} text={copy.recording} role="supporting" color={ctx.palette.secondary} testID="qandeel-enrollment-recording" /> : null}
      {state.notice === null || state.notice.origin !== 'ACT' ? null : (
        <Para ctx={ctx} text={copy[state.notice.key]} role="supporting" testID={`qandeel-enrollment-notice-${state.notice.key}`}
          color={state.notice.tone === 'ERROR' ? ctx.palette.error : state.notice.tone === 'DONE' ? ctx.palette.primary : ctx.palette.secondary} />
      )}
    </View>
  );
}

/** One consent the act exercises: its label, its exact current text, and its own «أوافق». */
function ConsentRow({ ctx, copy, consent, text, agreed, onToggle }: {
  readonly ctx: PartContext; readonly copy: EnrollmentCopy; readonly consent: EnrollmentConsentKind;
  readonly text: { readonly version: string; readonly textAr: string; readonly textEn: string }; readonly agreed: boolean; readonly onToggle: () => void;
}) {
  const { palette, language, writing } = ctx;
  const label = copy[LABEL[consent]];
  return (
    <View testID={`qandeel-enrollment-consent-${consent}`}
      style={{ backgroundColor: palette.field, borderRadius: CARD_RADIUS, paddingVertical: 10, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ ...typeStyle('action'), color: palette.primary, paddingStart: 8, paddingEnd: 8, paddingBottom: 4, writingDirection: writing }}>{label}</Text>
      <Text testID={`qandeel-enrollment-consent-${consent}-text`} accessibilityLanguage={language}
        style={{ ...typeStyle('body'), color: palette.primary, paddingStart: 8, paddingEnd: 8, writingDirection: writing }}>
        {language === 'ar' ? text.textAr : text.textEn}
      </Text>
      <Control palette={palette} language={language} accessibilityRole="togglebutton" accessibilityLabel={`${label}${language === 'ar' ? '، ' : ', '}${copy.agree}`}
        accessibilityState={{ checked: agreed, disabled: ctx.busy }} onPress={ctx.busy ? () => undefined : onToggle}
        testID={`qandeel-enrollment-agree-${consent}`}
        style={{ minHeight: MIN_TARGET, marginTop: 6, paddingStart: 8, paddingEnd: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', columnGap: 10,
          borderRadius: 0, opacity: ctx.busy ? BUSY_OPACITY : 1 }}>
        <View accessibilityElementsHidden importantForAccessibility="no"
          style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: palette.primary, alignItems: 'center', justifyContent: 'center',
            backgroundColor: agreed ? palette.primary : 'transparent' }}>
          {agreed ? <Text style={{ ...typeStyle('metadata'), color: palette.world, lineHeight: 18 }}>✓</Text> : null}
        </View>
        <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing, flexShrink: 1 }}>{copy.agree}</Text>
      </Control>
    </View>
  );
}

/** The one act offered now, with its consents; nothing while the gate is closed or a deletion is pending. */
export function EnrollmentStep({ ctx, controller, draft, onChanged }: {
  readonly ctx: PartContext; readonly controller: EnrollmentController; readonly draft: IntroductionsDraft | null;
  /** The server answered CHANGED / INCOMPLETE: the preparation is read again. */
  readonly onChanged?: () => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const copy = enrollmentCopy(ctx.language);
  // Agreeing is to ONE version of one text: a text that changed is never carried over as agreed.
  const [agreed, setAgreed] = useState<ReadonlySet<string>>(new Set());
  const view = state.view;
  const offer = view === null ? null : enrollmentOffer(view, draft, state.settledDraftVersion);
  const quiet: PartContext = { ...ctx, busy: ctx.busy || state.busy, onHeading: undefined };
  if (view === null) return null;
  if (offer === null) return <Notice ctx={ctx} controller={controller} copy={copy} />;

  const keyOf = (consent: EnrollmentConsentKind) => `${consent}:${view.consents[consent]?.version ?? ''}`;
  const agreedNow = new Set(offer.consents.filter((consent) => agreed.has(keyOf(consent))));
  const ready = offer.consents.every((consent) => agreedNow.has(consent));
  const toggle = (consent: EnrollmentConsentKind) => {
    const key = keyOf(consent);
    setAgreed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const run = async () => {
    const outcome = await controller.act(offer, agreedNow);
    if (outcome === 'CHANGED' || outcome === 'INCOMPLETE') onChanged?.();
    if (outcome !== null && outcome !== 'FAILED') setAgreed(new Set());
  };
  return (
    <View testID={`qandeel-enrollment-step-${offer.kind}`} style={{ paddingTop: 12 }}>
      {offer.kind === 'ENROLL' ? (<>
        <Heading ctx={quiet} text={copy.heading} testID="qandeel-enrollment-heading" />
        <Para ctx={quiet} text={copy.lead} role="supporting" color={ctx.palette.secondary} />
      </>) : null}
      {offer.consents.map((consent) => {
        const text = view.consents[consent];
        return text === null ? null : (
          <ConsentRow key={consent} ctx={quiet} copy={copy} consent={consent} text={text} agreed={agreedNow.has(consent)} onToggle={() => toggle(consent)} />
        );
      })}
      <Action ctx={{ ...quiet, onSheet: true }} primary label={copy[ACT_LABEL[offer.kind]]} disabled={!ready} onPress={() => void run()}
        testID={`qandeel-enrollment-act-${offer.kind}`} />
      <Notice ctx={ctx} controller={controller} copy={copy} />
    </View>
  );
}

/** «موافقات التعارف»: each consent's state, and the withdrawal of exactly one of them. */
export function ConsentControls({ ctx, controller }: { readonly ctx: PartContext; readonly controller: EnrollmentController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const copy = enrollmentCopy(ctx.language);
  const cancel = sharedCopy(ctx.language).cancel;
  const [confirming, setConfirming] = useState<EnrollmentConsentKind | null>(null);
  const view = state.view;
  // A withdrawal the server answered closes its confirmation (an answer lost keeps it open, to retry the same command).
  const withdraw = async (consent: EnrollmentConsentKind) => {
    const outcome = await controller.revoke(consent);
    if (outcome !== null && outcome !== 'FAILED') setConfirming(null);
  };
  if (view === null || !hasConsentControls(view)) return null;
  const quiet: PartContext = { ...ctx, busy: ctx.busy || state.busy, onHeading: undefined };
  const { palette, writing } = ctx;
  return (
    <View testID="qandeel-enrollment-consents" style={{ paddingTop: 12 }}>
      <Heading ctx={quiet} text={copy.consentsHeading} testID="qandeel-enrollment-consents-heading" />
      {ORDER.map((consent) => {
        const given = consentInForce(view, consent);
        return (
          <View key={consent} testID={`qandeel-enrollment-consent-state-${consent}`}
            style={{ backgroundColor: palette.field, borderRadius: CARD_RADIUS, paddingVertical: 10, paddingHorizontal: 8, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginTop: 6 }}>
            <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy[LABEL[consent]]}</Text>
            <Text testID={`qandeel-enrollment-consent-state-${consent}-${given ? 'given' : 'not-given'}`}
              style={{ ...typeStyle('supporting'), color: palette.secondary, marginTop: 2, writingDirection: writing }}>{given ? copy.given : copy.notGiven}</Text>
            {/* This consent's own answer, where the reader just acted (announced, not only drawn). */}
            <View testID={`qandeel-enrollment-consent-notice-${consent}`} accessibilityLiveRegion="polite">
              {state.notice === null || state.notice.origin !== 'WITHDRAWAL' || state.notice.consent !== consent ? null : (
                <Text testID={`qandeel-enrollment-consents-notice-${state.notice.key}`}
                  style={{ ...typeStyle('supporting'), color: state.notice.tone === 'ERROR' ? palette.error : palette.primary, marginTop: 4, writingDirection: writing }}>
                  {copy[state.notice.key]}
                </Text>
              )}
            </View>
            {!given ? null : confirming === consent ? (
              <View testID={`qandeel-enrollment-withdraw-confirm-${consent}`} style={{ paddingTop: 6 }}>
                <Text accessibilityRole="header" style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.withdrawTitle}</Text>
                <Text style={{ ...typeStyle('supporting'), color: palette.secondary, marginTop: 4, writingDirection: writing }}>{copy[WITHDRAW_BODY[consent]]}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, marginStart: -16 }}>
                  <Action ctx={quiet} label={copy.withdrawConfirm} onPress={() => void withdraw(consent)} testID={`qandeel-enrollment-withdraw-yes-${consent}`} />
                  <Action ctx={quiet} label={cancel} onPress={() => setConfirming(null)} testID={`qandeel-enrollment-withdraw-cancel-${consent}`} />
                </View>
              </View>
            ) : (
              <View style={{ marginStart: -16 }}>
                <Action ctx={quiet} label={copy.withdraw} onPress={() => { controller.dismissNotice(); setConfirming(consent); }} testID={`qandeel-enrollment-withdraw-${consent}`} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
