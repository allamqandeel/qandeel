/**
 * VPORT-02 — the concise temporal orientation line, placed at the top of the Timeline / Temporal Surface region.
 *
 * The G3 T-11 / T-12 controlled amendment (Decision B) froze the composition
 *
 *   Living Analysis World → temporal orientation line → Timeline / Temporal Surface → OrientationChrome
 *
 * and VPORT-02 is its production integration. The amendment moves only the line's PLACEMENT. T-08 keeps its words, its
 * presence and its truth (amendment §2 items 1–2), which is why the line lives here, in T-08, and says exactly T-08's
 * sentences from T-08's one copy file:
 *
 *   - PINNED: the pinned sentence, with its second sentence only when the conversation did continue;
 *   - a temporary Moment preview: the preview sentence, which says what is being looked at and that the reader's own
 *     position has not moved;
 *   - following Live: nothing at all, and no gap held for it (G3.2 K11).
 *
 * It is text, never a control: it takes no touch and adds no Return act (amendment §5). The row that composes it owns
 * its placement and keeps it out of every scroller, so it never scrolls away (amendment §3 rule 2).
 */
import { useCallback, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { useAnalysisInk, useAnalysisType } from '../analysis-visual';
import type { CanonicalStore } from '../state';
import type { TemporalPreview } from '../temporal-navigation';
import { temporalLineModel } from './model';
import { temporalLineSentence } from './product-copy';
import type { ChromeLanguage, TemporalPreviewSource } from './types';

export const TEMPORAL_ORIENTATION_LINE_TEST_ID = 'qandeel-temporal-orientation-line';

export interface TemporalOrientationLineProps {
  readonly store: CanonicalStore;
  readonly language: ChromeLanguage;
  /** T-06's preview controller, consumed READ-ONLY, exactly as OrientationChrome consumes it. */
  readonly preview?: TemporalPreviewSource | null;
}

const NOOP_UNSUBSCRIBE = () => undefined;

/** The line's words for one render, or `null` when no truthful temporal context exists. T-08's own sentence. */
export function temporalOrientationLine(store: CanonicalStore, language: ChromeLanguage, preview: TemporalPreview | null): string | null {
  const { temporal, live } = temporalLineModel(store, preview);
  return temporalLineSentence(language, temporal, live);
}

export function TemporalOrientationLine({ store, language, preview }: TemporalOrientationLineProps) {
  // Subscribed, never sampled: the line follows every canonical change and every preview publication.
  useSyncExternalStore(store.subscribe, store.getState);
  const subscribe = useCallback(
    (listener: () => void) => (preview === null || preview === undefined ? NOOP_UNSUBSCRIBE : preview.subscribe(listener)),
    [preview],
  );
  const getSnapshot = useCallback(() => (preview === null || preview === undefined ? null : preview.getSnapshot()), [preview]);
  const previewSnapshot = useSyncExternalStore(subscribe, getSnapshot);
  const ink = useAnalysisInk();
  const type = useAnalysisType();

  const words = temporalOrientationLine(store, language, previewSnapshot);
  if (words === null) return null;
  return (
    <View testID={TEMPORAL_ORIENTATION_LINE_TEST_ID} pointerEvents="none" style={{ paddingBottom: 4 }}>
      <Text style={[type('supporting'), { color: ink.primary }]}>{words}</Text>
    </View>
  );
}
