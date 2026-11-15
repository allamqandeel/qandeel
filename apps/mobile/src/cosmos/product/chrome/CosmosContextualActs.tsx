/**
 * COSMOS-INT-01 Slice C — the compact contextual controls of the Personal stage (Contract v1.4 §14 C-3 / C-4 / C-5,
 * §15.3 B, §16 A-2 / A-3): the T-07 return acts and T-04's context choice that the old chrome band presented as text
 * blocks, as compact glass chips. The old sentences are not drawn; the acts are. The Product Owner's UX correction
 * (§16) places them: the historical and Live-focus acts in ONE scrollable line at the start of the rail's words row
 * (`acts` allow-list, the chips wrapping), and `RETURN_WORLD` at a deeper rung as the one companion chip under the
 * Overview chip while Overview is on (`acts={['RETURN_WORLD']}`, `extras={false}`). The upper screen holds no other
 * control (U-1).
 *
 * The SEMANTICS are T-08's and T-07's, unchanged and reached through their own modules:
 *
 *   - which acts are meaningful right now is `orientationModel` (T-08): the frozen order, the knowledge-safe inputs,
 *     "absent, never disabled", the freshness gate before any semantic answer, the context chooser's options;
 *   - each chip reaches exactly ONE T-07 executor, by its frozen identity, with T-08's own label as its accessible
 *     name and T-08's own hint as its accessible hint (the hint is spoken, not drawn — §15.6);
 *   - a refused Exact Return retires its origin exactly as T-08's chrome retires it; Go Live + Locate is offered only
 *     where a live-context provider exists, exactly as before;
 *   - `RETURN_LIVE_HEAD` keeps its ONE home, the rail's Live words (VPORT-02), and is not a chip;
 *   - `RETURN_WORLD` at the first rung IS the stage's Back chip (the host's `home` seam); it is a chip only at a deeper
 *     rung, where the Back chip means one semantic step OUT (D-3: the semantic Back and the canonical return are two
 *     acts and read as two);
 *   - the technical inspection states ("not ready to show yet", "cannot be shown right now", "catching up") keep T-08's
 *     sentence, as one quiet line under the chips, only while an inspection is requested (as the old band did).
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { switchContext, type MapActionOutcome, type MapProjectionRequest } from '../../../map';
import {
  contextChoiceLabel,
  contextChoiceTitle,
  contextOrderingNote,
  exactReturnTargetFor,
  inspectionSentence,
  orientationModel,
  returnActWords,
  type ChromeLanguage,
  type ChromeProjection,
  type ExactReturnOrigin,
  type OrientationModel,
  type ReturnOpportunityId,
  type TemporalPreviewSource,
} from '../../../orientation-chrome';
import {
  backOneStep,
  exactReturn,
  goLiveAndLocate,
  returnLiveFocus,
  returnWorld,
  type ReturnMapContext,
  type ReturnOutcome,
  type ReturnSurface,
} from '../../../return-navigation';

export const COSMOS_ACTS_TEST_ID = 'qandeel-cosmos-acts';
/** The Overview companion (§16 A-2): the same component, drawing `RETURN_WORLD` only, under the Overview chip. */
export const COSMOS_OVERVIEW_ACT_TEST_ID = 'qandeel-cosmos-overview-act';
/** The acts the rail's words row carries (§16 A-3): everything but Return Live (the Live words) and Return World (Overview's companion). */
export const RAIL_ACTS: readonly ReturnOpportunityId[] = Object.freeze(['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_FOCUS', 'GO_LIVE_AND_LOCATE'] as const);
/** One return act's chip: `${prefix}${ReturnOpportunityId}`. */
export const COSMOS_ACT_TEST_ID_PREFIX = `${COSMOS_ACTS_TEST_ID}:`;
/** One contextual appearance's chip: `${prefix}${ordinal}`. */
export const COSMOS_CONTEXT_TEST_ID_PREFIX = `${COSMOS_ACTS_TEST_ID}:context:`;
export const COSMOS_ACTS_NOTE_TEST_ID = `${COSMOS_ACTS_TEST_ID}:note`;

const C = { ink: '#E9EAF4', quiet: '#9A9DB4', gold: '#ECCC8A', glass: 'rgba(11, 13, 26, 0.62)', hair: 'rgba(233, 234, 244, 0.16)' } as const;

/** The acts a chip may carry: Return Live's home is the rail (VPORT-02); the World return at the first rung is the Back chip. */
export function chipActs(model: OrientationModel): readonly ReturnOpportunityId[] {
  return model.returns.offered
    .map((each) => each.id)
    .filter((id) => id !== 'RETURN_LIVE_HEAD' && !(id === 'RETURN_WORLD' && model.spatial.depth === 'WORLD'));
}

const TECHNICAL = new Set(['PROJECTION_NOT_FETCHED', 'PROJECTION_UNAVAILABLE', 'PROJECTION_STALE', 'PROJECTION_INCOHERENT', 'INSPECTION_NOT_RESOLVED', 'RESOLUTION_MALFORMED']);

export interface CosmosContextualActsProps {
  readonly surface: ReturnSurface;
  readonly language: ChromeLanguage;
  readonly projection: ChromeProjection;
  readonly exactReturnOrigin?: ExactReturnOrigin | null;
  readonly preview?: TemporalPreviewSource | null;
  readonly liveContext?: (request: MapProjectionRequest) => ReturnMapContext;
  readonly onReturnOutcome?: (id: ReturnOpportunityId, outcome: ReturnOutcome) => void;
  readonly onMapOutcome?: (outcome: MapActionOutcome) => void;
  /** The acts this instance may draw, of those T-08 offers (default: every chip act). An act outside the list is another instance's. */
  readonly acts?: readonly ReturnOpportunityId[];
  /** T-04's context choice and the technical note belong to ONE instance (default true); the Overview companion draws neither. */
  readonly extras?: boolean;
  /** `wrap` (the default) wraps the chips; `line` is ONE horizontally scrollable row that never wraps and never grows (§16 A-3). */
  readonly testID?: string;
}

const NOOP_UNSUBSCRIBE = () => undefined;

export function CosmosContextualActs({ surface, language, projection, exactReturnOrigin, preview, liveContext, onReturnOutcome, onMapOutcome, acts: allowed, extras = true, testID = COSMOS_ACTS_TEST_ID }: CosmosContextualActsProps) {
  useSyncExternalStore(surface.store.subscribe, surface.store.getState);
  const subscribe = useCallback((listener: () => void) => (preview === null || preview === undefined ? NOOP_UNSUBSCRIBE : preview.subscribe(listener)), [preview]);
  const getSnapshot = useCallback(() => (preview === null || preview === undefined ? null : preview.getSnapshot()), [preview]);
  const previewSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  // T-08's one piece of Class-D state, subtractive: a refused origin is retired, never re-offered.
  const [refusedOrigin, setRefusedOrigin] = useState<ExactReturnOrigin | null>(null);
  const origin = exactReturnOrigin === undefined || exactReturnOrigin === null || exactReturnOrigin === refusedOrigin ? null : exactReturnOrigin;
  const exactReturnTarget = exactReturnTargetFor(surface.store, origin);
  const model = orientationModel(surface.store, projection, { exactReturnOrigin: origin, preview: previewSnapshot, liveContextAvailable: liveContext !== undefined });
  const current = model.projection.status === 'CURRENT' && projection.held ? projection.context : null;
  const acts = chipActs(model).filter((id) => allowed === undefined || allowed.includes(id));

  // Plain functions over the render-local model (the compiler memoises them; a manual list would name a local object).
  const run = (id: ReturnOpportunityId) => {
    if (!model.returns.offered.some((candidate) => candidate.id === id)) return;
    let outcome: ReturnOutcome;
    switch (id) {
      case 'BACK_ONE_STEP':
        outcome = backOneStep(surface);
        break;
      case 'EXACT_RETURN': {
        if (exactReturnTarget === null) return;
        outcome = exactReturn(surface, exactReturnTarget);
        break;
      }
      case 'RETURN_LIVE_HEAD':
        // Its one home is the rail (VPORT-02); no chip reaches here.
        return;
      case 'RETURN_LIVE_FOCUS': {
        if (current === null) return;
        outcome = returnLiveFocus(surface, { context: current });
        break;
      }
      case 'RETURN_WORLD':
        outcome = returnWorld(surface);
        break;
      case 'GO_LIVE_AND_LOCATE': {
        if (liveContext === undefined) return;
        outcome = goLiveAndLocate(surface, { liveContext });
        break;
      }
      default: {
        const exhaustive: never = id;
        return exhaustive;
      }
    }
    if (id === 'EXACT_RETURN' && outcome.outcome === 'REJECTED' && origin !== null) setRefusedOrigin(origin);
    onReturnOutcome?.(id, outcome);
  };

  const choose = (ordinal: number) => {
    const option = model.context.appearances.find((candidate) => candidate.ordinal === ordinal);
    const render = model.inspection.render;
    if (option === undefined || current === null || render.kind !== 'RENDERABLE') return;
    const outcome = switchContext(surface.store, current, {
      family: render.family,
      id: render.id,
      ...(render.versionIntent === null ? {} : { version: render.versionIntent }),
      appearance: { kind: 'THREAD_READING', bindingId: option.bindingId },
    });
    onMapOutcome?.(outcome);
  };

  const note = extras && model.inspection.requested && TECHNICAL.has(model.inspection.render.kind) ? inspectionSentence(language, model.inspection.render) : null;
  const choices = extras && model.context.choiceAvailable ? model.context.appearances : [];
  if (acts.length === 0 && choices.length === 0 && note === null) return null;
  const choiceHint = `${contextChoiceTitle(language)} ${contextOrderingNote(language)}`;

  const chips = acts.length === 0 && choices.length === 0 ? null : (
        <>
          {acts.map((id) => {
            const words = returnActWords(language, id);
            return (
              <Pressable key={id} testID={`${COSMOS_ACT_TEST_ID_PREFIX}${id}`} accessibilityRole="button" accessibilityLabel={words.label} accessibilityHint={words.hint}
                accessibilityLanguage={language} onPress={() => run(id)} style={styles.press}>
                <View style={styles.chip}><Text style={styles.chipText}>{words.label}</Text></View>
              </Pressable>
            );
          })}
          {choices.map((option) => {
            const label = contextChoiceLabel(language, option.current, option.boundAtMoment);
            return (
              <Pressable key={option.ordinal} testID={`${COSMOS_CONTEXT_TEST_ID_PREFIX}${option.ordinal}`} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={choiceHint}
                accessibilityLanguage={language} accessibilityState={{ selected: option.current }} onPress={() => choose(option.ordinal)} style={styles.press}>
                <View style={[styles.chip, option.current && styles.chipOn]}><Text style={[styles.chipText, option.current && styles.goldText]}>{label}</Text></View>
              </Pressable>
            );
          })}
        </>
      );

  return (
    <View testID={testID} style={styles.region} pointerEvents="box-none" accessibilityRole="none">
      {chips === null ? null : (
        // The chips WRAP (U-7, §16.6): a chip that does not fit beside its neighbours starts the next line, whole; a long
        // label wraps inside its own chip. Nothing is clipped and nothing scrolls out of sight (HONOR, 2026-11-16: the
        // one-line scroller cut the second Arabic chip at the slot's edge).
        <View style={styles.chips} pointerEvents="box-none" accessibilityRole="none">
          {chips}
        </View>
      )}
      {note === null ? null : (
        <View pointerEvents="none">
          <Text testID={COSMOS_ACTS_NOTE_TEST_ID} accessibilityLanguage={language} style={styles.note}>{note}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  region: { gap: 4 },
  // Identical in both languages (U-9): the row runs left → right; the words inside keep their own direction.
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  // T12-A95: every press target is at least 44 points; the compact 32-point chip sits inside it. A press target is never
  // wider than its row (`maxWidth`), so a long label wraps inside the chip instead of leaving the row (§16.6).
  press: { minHeight: 44, minWidth: 44, maxWidth: '100%', justifyContent: 'center' },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: C.gold },
  chipText: { fontSize: 12, lineHeight: 18, color: C.ink, textAlign: 'center' },
  goldText: { color: C.gold },
  note: { fontSize: 12, lineHeight: 18, color: C.quiet },
});
