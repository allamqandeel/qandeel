/**
 * S5-01 — the «العالم العام» / Public World area: the Public World root, behind its entry verdict.
 *
 * Entering resolves authority FIRST (CW2-07 §23–§25). Until the server says ALLOW only a neutral pre-authority shell is
 * drawn — the area's ground and nothing of the destination: no name, no Experience, no count. A refusal is one neutral
 * "not available" with a way to try again; it says nothing about why. On ALLOW the root becomes active: the Public
 * World's own name and its own ground.
 *
 * S5-03B: the root's field is the Public semantic field (`./field`) — every Experience the server serves, at its stable
 * place, under FAR / MID / NEAR disclosure, with search and a compact contextual panel over the SAME World. While
 * nothing is public it is empty by truth, and nothing stands in for it — no sample, feed, ranking or invented geography.
 * It is a World, not a feed. S5-03B R2: that field is analysed on the ONE Living Analysis surface — the Personal
 * Analysis's own screen, always dark — and this root hands it its heading for the surface's top band. This root keeps
 * only what is Public's to decide: the entry verdict, its waiting and refused states, and the way into authoring.
 * S5-02 adds
 * ONE way, after ALLOW, into the authoring workspace (`../public-authoring`): the reader's own non-public work, drawn in
 * place of the field and left by its own Back. It places nothing in the field.
 *
 * Back at the root is local-only: nothing is registered, so Back never silently returns to the Personal world
 * (I-08A4 §4). Nothing here reads the Personal world or the Shared area: no Session, camera, focus, time or World is
 * passed in, so none can transfer.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ActivityEntry, type ActivityAttentionController } from '../activity';
import { AnalysisAppearanceScope, AppearanceStatusBar } from '../appearance';
import { Control, typeStyle, usePalette, useConversationTypeface } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicCopy } from './copy';
import { PublicAuthoringWorkspace, publicAuthoringCopy, type PublicAuthoringScreen } from '../public-authoring';
import type { PublicWorldController } from './public-world-controller';
import { PublicLivingAnalysis } from './field/PublicLivingAnalysis';

export const PUBLIC_AREA_TEST_ID = 'qandeel-public-area';
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 24;
const noSubscribe = () => () => undefined;
const closedScreen = (): PublicAuthoringScreen => 'CLOSED';

export interface PublicWorldAreaProps {
  readonly controller: PublicWorldController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The one global Activity entry for this non-Analysis upper chrome (P3 §3); absent when the host has none. */
  readonly activity?: { readonly controller: ActivityAttentionController; readonly onOpen: () => void; readonly focus: boolean };
}

export function PublicWorldArea({ controller, language, insets, activity }: PublicWorldAreaProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = publicCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const { entry } = useSyncExternalStore(controller.subscribe, controller.getState);
  const authoring = controller.authoring;
  const authoringScreen = useSyncExternalStore(authoring ? authoring.subscribe : noSubscribe, authoring ? () => authoring.getState().screen : closedScreen);

  // Entering the area asks the entry verdict again — a previous ALLOW is never kept as authority.
  useEffect(() => {
    controller.enter();
    controller.authoring?.close();
  }, [controller]);

  // `analysis`: the root is the Living Analysis surface, whose place is dark under every preference, so the status bar
  // is decided for that ground.
  const frame = (testID: string, children: ReactNode, analysis = false) => (
    <View testID={PUBLIC_AREA_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      {analysis ? <AnalysisAppearanceScope><AppearanceStatusBar /></AnalysisAppearanceScope> : <AppearanceStatusBar />}
      <View testID={testID} style={{ flex: 1 }}>{children}</View>
    </View>
  );

  if (!ready || entry === 'NONE' || entry === 'RESOLVING') {
    // The pre-authority shell: the area's ground, and nothing of the destination.
    return frame('qandeel-public-resolving', (
      <View testID="qandeel-public-transition" accessible accessibilityLabel={copy.opening} accessibilityState={{ busy: true }}
        accessibilityLanguage={language} style={{ flex: 1, paddingTop: insets.top }} />
    ));
  }

  if (entry === 'DENIED') {
    return frame('qandeel-public-denied', (
      <View testID="qandeel-public-unavailable" accessibilityLiveRegion="polite" style={{ paddingTop: insets.top + HEADER_MIN_HEIGHT, padding: ROW_START, rowGap: 12 }}>
        <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.worldUnavailable}</Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.enter()} testID="qandeel-public-retry"
          style={{ alignSelf: 'flex-start' }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.retry}</Text>
        </Control>
      </View>
    ));
  }

  const workspaceOpen = authoring !== null && authoringScreen !== 'CLOSED';
  const heading = (
    <PublicHeading language={language} title={copy.publicWorld} activity={activity}
      onAuthoring={!workspaceOpen && authoring !== null ? () => authoring.open() : null} />
  );

  // S5-03B R2 — the field is analysed on the ONE Living Analysis surface; this root's heading is read first in its top band.
  if (!workspaceOpen && controller.field !== null) {
    return frame('qandeel-public-root', (
      <PublicLivingAnalysis controller={controller.field} language={language} insets={insets} heading={heading} />
    ), true);
  }

  return frame('qandeel-public-root', (
    <View style={{ flex: 1, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      {heading}
      {authoring !== null && workspaceOpen ? (
        <PublicAuthoringWorkspace controller={authoring} language={language} palette={palette} bottomInset={insets.bottom} />
      ) : (
        // Without a field controller, nothing stands in for the field.
        <View testID="qandeel-public-field" style={{ flex: 1 }} />
      )}
    </View>
  ));
}

/**
 * The Public World's heading: the Activity entry, its own name, and the one way into authoring. It paints in the
 * appearance of the place it is drawn in — the reader's around the authoring workspace, the Analysis's in the Living
 * Analysis surface's top band.
 */
function PublicHeading({ language, title, activity, onAuthoring }: {
  readonly language: ChromeLanguage; readonly title: string; readonly activity: PublicWorldAreaProps['activity']; readonly onAuthoring: (() => void) | null;
}) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View>
      <View style={{ paddingHorizontal: 10, minHeight: HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2 }}>
        {activity !== undefined ? <ActivityEntry controller={activity.controller} language={language} onOpen={activity.onOpen} focus={activity.focus} /> : null}
        <Text testID="qandeel-public-title" accessibilityRole="header" accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {title}
        </Text>
      </View>
      {onAuthoring !== null ? (
        <View style={{ paddingStart: ROW_START - 16 }}>
          <Control palette={palette} language={language} accessibilityLabel={publicAuthoringCopy(language).entry} onPress={onAuthoring}
            testID="qandeel-public-authoring-entry" style={{ alignSelf: 'flex-start', paddingHorizontal: 16 }}>
            <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{publicAuthoringCopy(language).entry}</Text>
          </Control>
        </View>
      ) : null}
    </View>
  );
}
