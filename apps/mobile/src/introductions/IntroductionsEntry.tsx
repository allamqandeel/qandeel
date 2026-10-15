/**
 * S6-01 — the manual «التعارف مع قنديل» / Introductions with QANDEEL entry (GATE-13: manual entry inside MY_WORLD; no
 * fourth World, no tab, no conversational offer before Stage 8A).
 *
 * It stands on Personal QANDEEL's own row, after the Understanding entry at the reader's START edge, as a word (no glyph
 * is frozen for it). It is drawn only when the server says preparation is available now, or the owner already has a
 * draft to see or delete: while both gates are closed and nothing was prepared, nothing is drawn — no teaser, no badge,
 * no notification.
 *
 * S6-04: it is drawn too when the server answered that this human holds a delivered private proposal, and while one
 * waits for their decision it carries one quiet mark and the arrival line for the screen reader — never a count, never
 * repeated, never urgent (D11).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View, findNodeHandle } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { introductionsCopy } from './copy';
import type { IntroductionsController } from './introductions-controller';
import { awaitsDecision, type ProposalsController, type ProposalsState } from './proposals-controller';
import { proposalsCopy } from './proposals-copy';

const NO_SUBSCRIPTION = () => () => undefined;

export interface IntroductionsEntryProps {
  readonly controller: IntroductionsController;
  readonly language: ChromeLanguage;
  readonly onOpen: () => void;
  /** Put the screen reader back on the entry once, when the owner returns from the preparation. */
  readonly focus?: boolean;
  /** S6-04: this human's own private proposals. Absent: the entry is exactly the S6-01 entry. */
  readonly proposals?: ProposalsController;
}

export function IntroductionsEntry({ controller, language, onOpen, focus = false, proposals }: IntroductionsEntryProps) {
  const palette = usePalette();
  const copy = introductionsCopy(language);
  const availability = useSyncExternalStore(controller.subscribe, () => controller.getState().availability);
  const offered: ProposalsState | null = useSyncExternalStore(proposals?.subscribe ?? NO_SUBSCRIPTION, () => proposals?.getState() ?? null);
  const node = useRef<View | null>(null);
  useEffect(() => {
    controller.refreshAvailability();
  }, [controller]);
  useEffect(() => {
    proposals?.refresh();
  }, [proposals]);
  const held = offered !== null && offered.status === 'READY' && offered.proposals.length > 0;
  const waiting = offered !== null && awaitsDecision(offered);
  const shown = (availability !== null && (availability.preparation || availability.hasDraft)) || held;
  useEffect(() => {
    if (!shown || !focus || node.current === null) return;
    const handle = findNodeHandle(node.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [focus, shown]);
  if (!shown) return null;
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={waiting ? `${copy.name}${language === 'ar' ? '، ' : ', '}${proposalsCopy(language).arrival}` : copy.name}
      onPress={onOpen}
      testID="qandeel-introductions-entry"
      controlRef={(value) => {
        node.current = value;
      }}
      style={{ paddingHorizontal: 12, flexShrink: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
        <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
          {copy.name}
        </Text>
        {waiting ? (
          <View testID="qandeel-introductions-entry-waiting" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary }} />
        ) : null}
      </View>
    </Control>
  );
}
