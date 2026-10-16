/**
 * S6-04 — «مقترحات التعارف» / Introduction proposals: the private space where a human reviews the proposals QANDEEL
 * delivered to them, and takes the decisions the server offers (D1–D12).
 *
 * It is a quiet page inside «التعارف مع قنديل», never a feed, a search or a ranking: each card says only that a private
 * opportunity exists and its permitted status — no name, photo, age, work, place, account or analysis of anyone (D3).
 * Three levels, each with its own heading where the screen reader arrives: the space, one proposal's review, and the
 * short confirmation of one decision. A button is drawn only for a decision the server offered. Everything after a
 * decision is the server's answer, said neutrally.
 *
 * S6-05 (CP5, V-1 S1–S4): when — and only when — the server offers the second recipient `ACCEPT`, the review draws IW-01;
 * one confirmation (IW-02, IW-03a–d, IW-04) states what agreeing does without claiming the other person agreed; a real
 * `MATCHED` answer shows «بدأ التعارف» (IW-05 / IW-05b) inside the same 2px start-edge seam as the World's opening, with
 * the entry (IW-06) as the one primary act. A MATCH_CONCLUDED card gains the same entry, for either human, once the
 * server lists a World of theirs joined to that proposal. The World itself is `IntroductionWorldSurface`; Back from it
 * returns here. While the launch gate is closed nothing offers ACCEPT, and `acceptNotYet` stays.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PrivateProposal, ProposalAction } from '../runtime-entry';
import { introductionWorldCopy, type IntroductionWorldCopy } from './introduction-world-copy';
import { worldOfProposal, type IntroductionWorldsController } from './introduction-world-controller';
import { IntroductionWorldSurface } from './IntroductionWorldSurface';
import { Action, BUSY_OPACITY, Heading, LOCAL_TYPE, Para, Question, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
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
  /** S6-05: the reader's own Introduction Worlds (the entry IW-06 and the World itself); absent, no entry is drawn. */
  readonly worlds?: IntroductionWorldsController;
}

type Screen =
  | { readonly kind: 'SPACE' }
  | { readonly kind: 'REVIEW'; readonly id: string }
  | { readonly kind: 'CONFIRM'; readonly id: string; readonly action: Exclude<ProposalAction, 'ACCEPT'> }
  /** S6-05 S2: the one acceptance confirmation. */
  | { readonly kind: 'ACCEPT'; readonly id: string }
  /** S6-05 S3: the server answered MATCHED and bound this World. */
  | { readonly kind: 'BEGUN'; readonly id: string; readonly worldId: string }
  /** S6-05: the Introduction World, opened from `from`. */
  | { readonly kind: 'WORLD'; readonly worldId: string; readonly from: Exclude<Screen, { readonly kind: 'WORLD' }> };

const noticeText = (notice: ProposalsNotice, copy: ProposalsCopy): string | null => (notice === null ? null : ({
  RECORDED_DECLINE: copy.recordedDecline, RECORDED_WITHDRAW: copy.recordedWithdraw, CHANGED: copy.changed,
  UNAVAILABLE: copy.unavailableBody, NOT_NOW: copy.notNow, FAILED: copy.failed, INVALID: copy.invalid,
})[notice]);

/** The comma that joins a card's title and status for the screen reader, in the reading language. */
const joined = (language: ChromeLanguage, a: string, b: string) => `${a}${language === 'ar' ? '، ' : ', '}${b}`;

export function ProposalsSurface({ controller, language, insets, onBack, worlds }: ProposalsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = proposalsCopy(language);
  const iw = introductionWorldCopy(language);
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
  // S6-05: the reader's own Introduction Worlds, read again whenever the space is shown (the MATCH_CONCLUDED entry).
  const onSpace = screen.kind === 'SPACE';
  useEffect(() => {
    if (onSpace) worlds?.refresh();
  }, [worlds, onSpace]);

  // Android system Back walks back one level, and leaves the space only from its first level.
  const back = () => {
    controller.dismissNotice();
    if (screen.kind === 'CONFIRM' || screen.kind === 'ACCEPT' || screen.kind === 'BEGUN') {
      if (!state.busy) setScreen({ kind: 'REVIEW', id: screen.id });
    } else if (screen.kind === 'WORLD') setScreen(screen.from);
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
  const screenKey = screen.kind === 'SPACE' ? 'SPACE' : screen.kind === 'WORLD' ? `WORLD|${screen.worldId}`
    : `${screen.kind}|${screen.id}|${screen.kind === 'CONFIRM' ? screen.action : ''}`;
  useEffect(() => {
    if (!ready) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const node = headingRef.current === null ? null : findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, screenKey]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={PROPOSALS_SURFACE_TEST_ID} />;

  if (screen.kind === 'WORLD' && worlds !== undefined) {
    // S6-05: the Introduction World itself. Back returns to exactly where it was opened from.
    return <IntroductionWorldSurface controller={worlds} worldId={screen.worldId} language={language} insets={insets} onBack={() => setScreen(screen.from)} />;
  }
  const enter = (worldId: string, from: Exclude<Screen, { readonly kind: 'WORLD' }>) => {
    controller.dismissNotice();
    setScreen({ kind: 'WORLD', worldId, from });
  };

  const selected = screen.kind === 'SPACE' || screen.kind === 'WORLD' ? null : state.proposals.find((p) => p.proposalId === screen.id) ?? null;
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
    body = <Space ctx={ctx} copy={copy} controller={controller} onOpen={(id) => { controller.dismissNotice(); setScreen({ kind: 'REVIEW', id }); }}
      worlds={worlds} iw={iw} onEnter={(worldId) => enter(worldId, { kind: 'SPACE' })} />;
  } else if (screen.kind === 'BEGUN') {
    // S3 — a real result for the second party: the server's MATCHED and its World, nothing else.
    body = <Begun ctx={ctx} iw={iw} />;
    const worldId = screen.worldId;
    act = worlds === undefined ? null : sheet(
      <Action ctx={sheetCtx} primary label={iw.enter} onPress={() => enter(worldId, { kind: 'REVIEW', id: screen.id })} testID="qandeel-proposals-enter-world" />,
    );
  } else if (selected === null || screen.kind === 'WORLD') {
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
        {offered.includes('ACCEPT') ? (
          // IW-01: only because the server offers ACCEPT now (S6-05).
          <Action ctx={sheetCtx} primary label={iw.acceptAction} onPress={() => setScreen({ kind: 'ACCEPT', id: selected.proposalId })}
            testID="qandeel-proposals-accept" />
        ) : null}
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
  } else if (screen.kind === 'ACCEPT') {
    if (!selected.actions.includes('ACCEPT')) {
      // The server no longer offers it (the proposal changed underneath): back to what is true now.
      body = <Review ctx={ctx} copy={copy} proposal={selected} />;
    } else {
      body = <AcceptConfirmation ctx={ctx} iw={iw} />;
      const agree = async () => {
        if (controller.getState().busy) return;
        const worldId = await controller.accept(selected.proposalId);
        if (worldId !== null) setScreen({ kind: 'BEGUN', id: selected.proposalId, worldId });
        else if (controller.getState().notice !== 'FAILED') setScreen({ kind: 'REVIEW', id: selected.proposalId });
      };
      act = sheet(<>
        <View style={{ opacity: state.busy ? BUSY_OPACITY : 1 }}>
          <Action ctx={sheetCtx} primary label={state.busy ? iw.accepting : iw.acceptConfirm} onPress={() => void agree()} testID="qandeel-proposals-accept-confirm" />
        </View>
        <Action ctx={sheetCtx} label={copy.back} onPress={() => { if (!state.busy) setScreen({ kind: 'REVIEW', id: selected.proposalId }); }} testID="qandeel-proposals-accept-cancel" />
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
function Space({ ctx, copy, controller, onOpen, worlds, iw, onEnter }: {
  readonly ctx: PartContext; readonly copy: ProposalsCopy; readonly controller: ProposalsController; readonly onOpen: (id: string) => void;
  readonly worlds: IntroductionWorldsController | undefined; readonly iw: IntroductionWorldCopy; readonly onEnter: (worldId: string) => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const worldsState = useSyncExternalStore(worlds?.subscribe ?? noSubscription, worlds?.getState ?? noWorlds);
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
        {state.proposals.map((p) => {
          const card = <Card key={p.proposalId} ctx={ctx} copy={copy} proposal={p} onOpen={() => onOpen(p.proposalId)} />;
          // S4: a World the server lists for this human, joined to the same proposal, gains its entry (IW-06) — either human.
          const world = p.status === 'MATCH_CONCLUDED' && worldsState !== null ? worldOfProposal(worldsState, p.proposalId) : null;
          if (world === null) return card;
          return (
            <View key={p.proposalId} style={{ marginStart: ROW_START - 8, marginEnd: ROW_END - 8, borderRadius: CARD_RADIUS, backgroundColor: ctx.palette.field }}>
              <Card ctx={ctx} copy={copy} proposal={p} onOpen={() => onOpen(p.proposalId)} joined />
              <Control palette={ctx.palette} language={ctx.language} accessibilityLabel={iw.enter} onPress={() => onEnter(world.worldId)}
                testID={`qandeel-proposals-enter-${p.proposalId}`}
                style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, marginStart: 26, marginEnd: 16, marginBottom: 6, paddingHorizontal: 8, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('action'), color: ctx.palette.primary, writingDirection: ctx.writing }}>{iw.enter}</Text>
              </Control>
            </View>
          );
        })}
      </View>
      {state.next === null ? null : (
        <Action ctx={{ ...ctx, busy: ctx.busy || state.loadingMore }} label={copy.more} onPress={() => controller.more()} testID="qandeel-proposals-more" />
      )}
    </View>
  );
}

/** The neutral card: a private opportunity exists, and its permitted status. Nothing about anyone. */
function Card({ ctx, copy, proposal, onOpen, joined: inCard = false }: {
  readonly ctx: PartContext; readonly copy: ProposalsCopy; readonly proposal: PrivateProposal; readonly onOpen: () => void;
  /** S6-05: drawn inside a card that also holds its World's entry. */
  readonly joined?: boolean;
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
      style={{ marginStart: inCard ? 0 : ROW_START - 8, marginEnd: inCard ? 0 : ROW_END - 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: CARD_RADIUS,
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
    // S6-05: ACCEPT offered (S1) — the review stays as approved, and only the primary act (IW-01) is new.
    const accept = proposal.actions.includes('ACCEPT');
    const declineOnly = !forward && !accept && proposal.actions.includes('DECLINE');
    return (
      <View testID="qandeel-proposals-review">
        {head}
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
        ) : accept ? null : declineOnly ? (
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

const noSubscription = () => () => undefined;
const noWorlds = () => null;

/** S2 — one confirmation: what agreeing does, never that the other person already agreed. No checkbox; one explicit act. */
function AcceptConfirmation({ ctx, iw }: { readonly ctx: PartContext; readonly iw: IntroductionWorldCopy }) {
  const { palette, writing } = ctx;
  const points = [iw.acceptBegins, iw.acceptNameOnly, iw.acceptProtected, iw.acceptEitherEnds];
  return (
    <View testID="qandeel-proposals-accept-confirmation">
      <Question ctx={ctx} text={iw.acceptTitle} testID="qandeel-proposals-heading" />
      <View style={{ rowGap: 6, paddingTop: 4 }}>
        {points.map((point, index) => (
          <View key={index} testID={`qandeel-proposals-accept-point-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingStart: ROW_START, paddingEnd: ROW_END, columnGap: 10 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 12, backgroundColor: palette.secondary }} />
            <Text style={{ ...typeStyle('body'), color: palette.primary, flexShrink: 1, writingDirection: writing }}>{point}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** S3 — «بدأ التعارف» inside the same 2px start-edge seam as the World's opening, at the existing large-title size. */
function Begun({ ctx, iw }: { readonly ctx: PartContext; readonly iw: IntroductionWorldCopy }) {
  const { palette, language, writing, onHeading } = ctx;
  return (
    <View testID="qandeel-proposals-begun">
      <View testID="qandeel-proposals-begun-seam"
        style={{ marginStart: ROW_START, marginEnd: ROW_END, marginTop: 34, marginBottom: 10, paddingVertical: 10, paddingStart: 14,
          borderStartWidth: palette.markerThickness, borderStartColor: palette.selectedMarker }}>
        <Text ref={onHeading} accessibilityRole="header" accessibilityLanguage={language} testID="qandeel-proposals-heading"
          style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing }}>{iw.begunTitle}</Text>
      </View>
      <Para ctx={ctx} text={iw.begunBody} testID="qandeel-proposals-begun-body" />
    </View>
  );
}

/**
 * The quiet arrival inside «التعارف مع قنديل» (D1, D11): one line when a delivered proposal waits for this human, and a
 * way back to the space whenever the human has any. Never a count, never repeated, never urgent; nothing when there is
 * no proposal at all.
 */
export function ProposalsCue({ controller, language, onOpen, focus = false }: {
  readonly controller: ProposalsController; readonly language: ChromeLanguage; readonly onOpen: () => void;
  /** Put the screen reader back on the way into the space once, when the human returns from it. */
  readonly focus?: boolean;
}) {
  const palette = usePalette();
  const copy = proposalsCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const ctx: PartContext = { palette, language, writing, busy: false };
  const node = useRef<View | null>(null);
  const shown = state.status === 'READY' && state.proposals.length > 0;
  useEffect(() => {
    if (!shown || !focus || node.current === null) return;
    const handle = findNodeHandle(node.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [focus, shown]);
  if (!shown) return null;
  const waiting = awaitsDecision(state);
  const label = waiting ? copy.openSpace : copy.spaceTitle;
  return (
    <View testID="qandeel-proposals-cue" style={{ paddingTop: 4, paddingBottom: 4 }}>
      {waiting ? <Para ctx={ctx} text={copy.arrival} testID="qandeel-proposals-arrival" /> : null}
      <Control palette={palette} language={language} accessibilityLabel={label} onPress={onOpen} testID="qandeel-proposals-open"
        controlRef={(value) => { node.current = value; }}
        style={{ alignSelf: 'flex-start', marginStart: ROW_START - 8, paddingHorizontal: 8, minHeight: MIN_TARGET, justifyContent: 'center' }}>
        <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{label}</Text>
      </Control>
    </View>
  );
}
