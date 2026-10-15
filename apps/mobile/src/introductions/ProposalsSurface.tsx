/**
 * S6-04 — «مقترحات التعارف» / Introduction proposals: the private space where a human reviews the proposals QANDEEL
 * delivered to them, and takes the decisions the server offers (D1–D12).
 *
 * It is a quiet page inside «التعارف مع قنديل», never a feed, a search or a ranking: each card says only that a private
 * opportunity exists and its permitted status — no name, photo, age, work, place, account or analysis of anyone (D3).
 * Three levels, each with its own heading where the screen reader arrives: the space, one proposal's review, and the
 * short confirmation of one decision. A button is drawn only for a decision the server offered; there is no acceptance
 * here (S6-05). Everything after a decision is the server's answer, said neutrally.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PrivateProposal, ProposalAction } from '../runtime-entry';
import { Action, Heading, LOCAL_TYPE, Para, Question, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import { proposalsCopy, type ProposalsCopy } from './proposals-copy';
import { awaitsDecision, type ProposalsController, type ProposalsNotice } from './proposals-controller';

export const PROPOSALS_SURFACE_TEST_ID = 'qandeel-proposals';
const HEADER_MIN_HEIGHT = 56;
const SHEET_RADIUS = 24;
const CARD_RADIUS = 16;

export interface ProposalsSurfaceProps {
  readonly controller: ProposalsController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly onBack: () => void;
}

type Screen =
  | { readonly kind: 'SPACE' }
  | { readonly kind: 'REVIEW'; readonly id: string }
  | { readonly kind: 'CONFIRM'; readonly id: string; readonly action: ProposalAction };

const noticeText = (notice: ProposalsNotice, copy: ProposalsCopy): string | null => (notice === null ? null : ({
  RECORDED_DECLINE: copy.recordedDecline, RECORDED_WITHDRAW: copy.recordedWithdraw, CHANGED: copy.changed,
  UNAVAILABLE: copy.unavailableBody, NOT_NOW: copy.notNow, FAILED: copy.failed, INVALID: copy.invalid,
})[notice]);

/** The comma that joins a card's title and status for the screen reader, in the reading language. */
const joined = (language: ChromeLanguage, a: string, b: string) => `${a}${language === 'ar' ? '، ' : ', '}${b}`;

export function ProposalsSurface({ controller, language, insets, onBack }: ProposalsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = proposalsCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const headingRef = useRef<Text | null>(null);
  const onHeading = useCallback((node: Text | null) => { headingRef.current = node; }, []);
  const ctx: PartContext = { palette, language, writing, busy: state.busy, onHeading };
  const sheetCtx: PartContext = { ...ctx, onSheet: true };
  const [screen, setScreen] = useState<Screen>({ kind: 'SPACE' });
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    controller.refresh();
  }, [controller]);

  // Android system Back walks back one level, and leaves the space only from its first level.
  const back = () => {
    controller.dismissNotice();
    if (screen.kind === 'CONFIRM') setScreen({ kind: 'REVIEW', id: screen.id });
    else if (screen.kind === 'REVIEW') setScreen({ kind: 'SPACE' });
    else onBack();
  };
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // The screen reader arrives on each level's heading once, and the page starts at its top.
  const screenKey = screen.kind === 'SPACE' ? 'SPACE' : `${screen.kind}|${screen.id}|${screen.kind === 'CONFIRM' ? screen.action : ''}`;
  useEffect(() => {
    if (!ready) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const node = headingRef.current === null ? null : findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, screenKey]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={PROPOSALS_SURFACE_TEST_ID} />;

  const selected = screen.kind === 'SPACE' ? null : state.proposals.find((p) => p.proposalId === screen.id) ?? null;
  const notice = noticeText(state.notice, copy);

  const sheet = (children: ReactNode) => (
    <View testID="qandeel-proposals-sheet"
      style={{ backgroundColor: palette.field, borderTopStartRadius: SHEET_RADIUS, borderTopEndRadius: SHEET_RADIUS, paddingTop: 14, paddingBottom: insets.bottom + 16, marginTop: 16 }}>
      {children}
    </View>
  );

  let body: ReactNode;
  let act: ReactNode = null;
  if (screen.kind === 'SPACE') {
    body = <Space ctx={ctx} copy={copy} controller={controller} onOpen={(id) => { controller.dismissNotice(); setScreen({ kind: 'REVIEW', id }); }} />;
  } else if (selected === null) {
    // The proposal is no longer among this human's own (it cannot be vouched for): one neutral line.
    body = (
      <View testID="qandeel-proposals-review">
        <Question ctx={ctx} text={copy.cardTitle} testID="qandeel-proposals-heading" />
        <Para ctx={ctx} text={copy.unavailableBody} color={palette.secondary} testID="qandeel-proposals-status-body" />
      </View>
    );
  } else if (screen.kind === 'REVIEW') {
    body = <Review ctx={ctx} copy={copy} proposal={selected} />;
    const offered = selected.actions;
    if (offered.length > 0) {
      act = sheet(<>
        {offered.includes('APPROVE_FORWARD') ? (
          <Action ctx={sheetCtx} primary label={copy.allowAction} onPress={() => setScreen({ kind: 'CONFIRM', id: selected.proposalId, action: 'APPROVE_FORWARD' })}
            testID="qandeel-proposals-allow" />
        ) : null}
        {offered.includes('DECLINE') ? (
          <Action ctx={sheetCtx} label={copy.declineAction} onPress={() => setScreen({ kind: 'CONFIRM', id: selected.proposalId, action: 'DECLINE' })}
            testID="qandeel-proposals-decline" />
        ) : null}
        {offered.includes('WITHDRAW') ? (
          <Action ctx={sheetCtx} label={copy.withdrawAction} onPress={() => setScreen({ kind: 'CONFIRM', id: selected.proposalId, action: 'WITHDRAW' })}
            testID="qandeel-proposals-withdraw" />
        ) : null}
      </>);
    }
  } else {
    const action = screen.action;
    if (!selected.actions.includes(action)) {
      // The server no longer offers this decision (the review changed underneath): back to what is true now.
      body = <Review ctx={ctx} copy={copy} proposal={selected} />;
    } else {
      body = (
        <View testID={`qandeel-proposals-confirm-${action}`}>
          <Question ctx={ctx} text={copy.confirmTitle} testID="qandeel-proposals-heading" />
          {action === 'APPROVE_FORWARD' ? (<>
            <Para ctx={ctx} text={copy.forwardMeaning} />
            <Para ctx={ctx} text={copy.forwardNotYet} testID="qandeel-proposals-not-yet" />
            <Para ctx={ctx} text={copy.forwardMutual} />
            <Para ctx={ctx} text={copy.forwardWithdrawNote} role="supporting" color={palette.secondary} />
          </>) : (
            <Para ctx={ctx} text={action === 'DECLINE' ? copy.confirmDeclineBody : copy.confirmWithdrawBody} />
          )}
        </View>
      );
      const done = (recorded: boolean) => {
        if (recorded || controller.getState().notice !== 'FAILED') setScreen({ kind: 'REVIEW', id: selected.proposalId });
      };
      act = sheet(<>
        <Action ctx={sheetCtx} primary label={action === 'APPROVE_FORWARD' ? copy.confirmAllow : copy.confirm}
          onPress={() => void controller.decide(selected.proposalId, action).then(done)} testID="qandeel-proposals-confirm" />
        <Action ctx={sheetCtx} label={copy.back} onPress={() => setScreen({ kind: 'REVIEW', id: selected.proposalId })} testID="qandeel-proposals-cancel" />
      </>);
    }
  }

  return (
    <View testID={PROPOSALS_SURFACE_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
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
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={back} testID="qandeel-proposals-back"
          style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text
          testID="qandeel-proposals-title"
          accessibilityRole={screen.kind === 'SPACE' ? undefined : 'header'}
          accessibilityLanguage={language}
          style={{ ...LOCAL_TYPE.header, color: palette.primary, flexShrink: 1, paddingHorizontal: 2, writingDirection: writing }}
        >
          {copy.spaceTitle}
        </Text>
      </View>
      <View testID="qandeel-proposals-notice" accessibilityLiveRegion="polite">
        {notice === null ? null : (
          <Para ctx={ctx} text={notice} role="supporting"
            color={state.notice === 'FAILED' || state.notice === 'INVALID' ? palette.error : palette.secondary} testID="qandeel-proposals-notice-text" />
        )}
      </View>
      <ScrollView ref={scrollRef} testID="qandeel-proposals-body" style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: act === null ? insets.bottom + 16 : 0 }}>
        <View style={{ flexGrow: 1 }}>
          {body}
          <View style={{ flexGrow: 1 }} />
          {act}
        </View>
      </ScrollView>
    </View>
  );
}

/** The space: what the server answered about this human's own proposals, newest first, and nothing else. */
function Space({ ctx, copy, controller, onOpen }: {
  readonly ctx: PartContext; readonly copy: ProposalsCopy; readonly controller: ProposalsController; readonly onOpen: (id: string) => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const { palette } = ctx;
  const heading = <Question ctx={ctx} text={copy.spaceTitle} testID="qandeel-proposals-heading" />;
  if (state.status === 'IDLE' || state.status === 'LOADING') {
    return (
      <View testID="qandeel-proposals-loading" accessibilityState={{ busy: true }}>
        {heading}
        <Para ctx={ctx} text={copy.loading} role="supporting" color={palette.secondary} />
      </View>
    );
  }
  if (state.status === 'UNAVAILABLE' || state.status === 'OFFLINE') {
    return (
      <View testID={state.status === 'OFFLINE' ? 'qandeel-proposals-offline' : 'qandeel-proposals-unavailable'}>
        {heading}
        <Para ctx={ctx} text={state.status === 'OFFLINE' ? copy.offline : copy.unavailable} color={palette.error} />
        <Action ctx={ctx} label={copy.tryAgain} onPress={() => controller.refresh()} testID="qandeel-proposals-retry" />
      </View>
    );
  }
  if (state.proposals.length === 0) {
    return (
      <View testID="qandeel-proposals-empty">
        {heading}
        <Para ctx={ctx} text={copy.empty} color={palette.secondary} />
      </View>
    );
  }
  return (
    <View testID="qandeel-proposals-space">
      {heading}
      <Para ctx={ctx} text={copy.spaceIntro} role="supporting" color={palette.secondary} />
      <View style={{ rowGap: 10, paddingTop: 8 }}>
        {state.proposals.map((p) => <Card key={p.proposalId} ctx={ctx} copy={copy} proposal={p} onOpen={() => onOpen(p.proposalId)} />)}
      </View>
      {state.next === null ? null : (
        <Action ctx={{ ...ctx, busy: ctx.busy || state.loadingMore }} label={copy.more} onPress={() => controller.more()} testID="qandeel-proposals-more" />
      )}
    </View>
  );
}

/** The neutral card: a private opportunity exists, and its permitted status. Nothing about anyone. */
function Card({ ctx, copy, proposal, onOpen }: {
  readonly ctx: PartContext; readonly copy: ProposalsCopy; readonly proposal: PrivateProposal; readonly onOpen: () => void;
}) {
  const { palette, language, writing } = ctx;
  const status = copy[proposal.status];
  const waiting = proposal.status === 'AWAITING_YOU';
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={joined(language, copy.cardTitle, status)}
      onPress={onOpen}
      testID={`qandeel-proposals-card-${proposal.proposalId}`}
      style={{ marginStart: ROW_START - 8, marginEnd: ROW_END - 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: CARD_RADIUS,
        backgroundColor: palette.field, alignItems: 'stretch', minHeight: MIN_TARGET }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
        {/* A quiet mark for "waiting for you": never a count, never colour alone (the status words say it too). */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: waiting ? palette.primary : 'transparent', borderWidth: 1, borderColor: palette.tertiary }} />
        <View style={{ flexShrink: 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.cardTitle}</Text>
          <Text testID={`qandeel-proposals-card-status-${proposal.proposalId}`} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{status}</Text>
        </View>
      </View>
    </Control>
  );
}

/** One proposal's review: what it means, QANDEEL's role, the privacy promise, and what each decision would do. */
function Review({ ctx, copy, proposal }: { readonly ctx: PartContext; readonly copy: ProposalsCopy; readonly proposal: PrivateProposal }) {
  const { palette } = ctx;
  const head = (<>
    <Question ctx={ctx} text={copy.cardTitle} testID="qandeel-proposals-heading" />
    <Para ctx={ctx} text={copy[proposal.status]} role="supporting" color={palette.secondary} testID="qandeel-proposals-status" />
  </>);
  if (proposal.status === 'AWAITING_YOU') {
    const forward = proposal.actions.includes('APPROVE_FORWARD');
    const declineOnly = !forward && proposal.actions.includes('DECLINE');
    return (
      <View testID="qandeel-proposals-review">
        {head}
        <Para ctx={ctx} text={copy.opening} testID="qandeel-proposals-opening" />
        <Para ctx={ctx} text={copy.reviewLead} />
        <Para ctx={ctx} text={copy.qandeelRole} role="supporting" color={palette.secondary} />
        {forward ? (
          <View testID="qandeel-proposals-forward-meaning" style={{ paddingTop: 8 }}>
            <Heading ctx={ctx} text={copy.forwardTitle} />
            <Para ctx={ctx} text={copy.forwardMeaning} />
            <Para ctx={ctx} text={copy.forwardNotYet} />
            <Para ctx={ctx} text={copy.forwardMutual} />
            <Para ctx={ctx} text={copy.forwardWithdrawNote} role="supporting" color={palette.secondary} />
          </View>
        ) : declineOnly ? (
          <Para ctx={ctx} text={copy.acceptNotYet} role="supporting" color={palette.secondary} testID="qandeel-proposals-accept-not-yet" />
        ) : (
          <Para ctx={ctx} text={copy.decisionsPaused} role="supporting" color={palette.secondary} testID="qandeel-proposals-paused" />
        )}
        <View style={{ paddingTop: 8 }}>
          <Para ctx={ctx} text={copy.privacy} testID="qandeel-proposals-privacy" />
        </View>
      </View>
    );
  }
  const line = proposal.status === 'IN_PROGRESS' ? copy.inProgressBody
    : proposal.status === 'CLOSED_BY_YOU' ? copy.closedBody
      : proposal.status === 'MATCH_CONCLUDED' ? copy.concludedBody
        : copy.unavailableBody;
  return (
    <View testID="qandeel-proposals-review">
      {head}
      <Para ctx={ctx} text={line} testID="qandeel-proposals-status-body" />
      {proposal.actions.includes('WITHDRAW') ? (
        <Para ctx={ctx} text={copy.forwardWithdrawNote} role="supporting" color={palette.secondary} />
      ) : null}
    </View>
  );
}

/**
 * The quiet arrival inside «التعارف مع قنديل» (D1, D11): one line when a delivered proposal waits for this human, and a
 * way back to the space whenever the human has any. Never a count, never repeated, never urgent; nothing when there is
 * no proposal at all.
 */
export function ProposalsCue({ controller, language, onOpen }: {
  readonly controller: ProposalsController; readonly language: ChromeLanguage; readonly onOpen: () => void;
}) {
  const palette = usePalette();
  const copy = proposalsCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const ctx: PartContext = { palette, language, writing, busy: false };
  if (state.status !== 'READY' || state.proposals.length === 0) return null;
  const waiting = awaitsDecision(state);
  return (
    <View testID="qandeel-proposals-cue" style={{ paddingTop: 4, paddingBottom: 4 }}>
      {waiting ? <Para ctx={ctx} text={copy.arrival} testID="qandeel-proposals-arrival" /> : null}
      <Action ctx={ctx} inline label={waiting ? copy.openSpace : copy.spaceTitle} onPress={onOpen} testID="qandeel-proposals-open" />
    </View>
  );
}
