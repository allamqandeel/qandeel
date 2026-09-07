/**
 * T-10.0 MOTION LAB — the act layer: every Product act a prototype can perform, each reaching
 * exactly one existing executor, tagged with the CAUSE the presentation may read afterwards.
 *
 * The cause is presentation metadata and nothing else. It never enters the store, never chooses
 * an executor, and never changes what an act does; it exists so that a canonical change can be
 * SHOWN with the choreography of the act that produced it (P8: every Return act has its own
 * motion truth). The store answers first; the cause is what the world is told afterwards.
 */
import {
  directJump,
  inspectObject,
  panByTranslation,
  zoomSemanticStep,
  type DirectJumpOutcome,
  type MapActionOutcome,
  type MapInspectionContext,
  type PlacedNode,
} from '../../map';
import {
  backOneStep,
  exactReturn,
  goLiveAndLocate,
  returnLiveFocus,
  returnLiveHead,
  returnWorld,
  type ReturnCheckpointTarget,
  type ReturnOutcome,
  type ReturnSurface,
} from '../../return-navigation';
import type { CanonicalStore } from '../../state';
import { advanceLive, type LiveAdvanceOutcome } from './lab-store';
import { labLiveContextProvider } from './lab-projection';
import { LAB_WORLD, type LabWorld } from './lab-world';

export type LabCause =
  | 'PAN'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'DIRECT_JUMP'
  | 'INSPECT'
  | 'TEMPORAL'
  | 'LIVE_ADVANCE'
  | 'RETURN_LIVE_HEAD'
  | 'RETURN_LIVE_FOCUS'
  | 'GO_LIVE_AND_LOCATE'
  | 'RETURN_WORLD'
  | 'BACK_ONE_STEP'
  | 'EXACT_RETURN';

/** A one-slot channel: the cause of the most recent act, readable by the presentation afterwards. */
export interface CauseChannel {
  readonly last: () => LabCause | null;
  readonly run: <T>(cause: LabCause, act: () => T) => T;
  /** Records a cause for an act that reached its executor through a production surface (chrome, timeline). */
  readonly mark: (cause: LabCause) => void;
}

export function createCauseChannel(): CauseChannel {
  let last: LabCause | null = null;
  return {
    last: () => last,
    run: (cause, act) => {
      last = cause;
      return act();
    },
    mark: (cause) => {
      last = cause;
    },
  };
}

export type LabOutcome =
  | { readonly kind: 'MAP'; readonly cause: LabCause; readonly outcome: MapActionOutcome | DirectJumpOutcome }
  | { readonly kind: 'RETURN'; readonly cause: LabCause; readonly outcome: ReturnOutcome }
  | { readonly kind: 'LIVE'; readonly cause: LabCause; readonly outcome: LiveAdvanceOutcome };

export interface LabActs {
  readonly pan: (translationX: number, translationY: number) => LabOutcome;
  readonly zoom: (direction: 'IN' | 'OUT') => LabOutcome;
  /** A tap on a drawn node: a Direct Jump for a placed object, an inspection for a register entry. */
  readonly tap: (context: MapInspectionContext, node: PlacedNode) => LabOutcome;
  readonly inspect: (context: MapInspectionContext, family: PlacedNode['family'], id: string) => LabOutcome;
  readonly returnLiveHead: () => LabOutcome;
  readonly returnLiveFocus: (context: MapInspectionContext) => LabOutcome;
  readonly goLiveAndLocate: () => LabOutcome;
  readonly returnWorld: () => LabOutcome;
  readonly backOneStep: () => LabOutcome;
  readonly exactReturn: (target: ReturnCheckpointTarget) => LabOutcome;
  readonly advanceLive: () => LabOutcome;
}

export function createLabActs(surface: ReturnSurface, channel: CauseChannel, world: LabWorld = LAB_WORLD): LabActs {
  const store: CanonicalStore = surface.store;
  const liveContext = labLiveContextProvider(store, world);
  const map = (cause: LabCause, act: () => MapActionOutcome | DirectJumpOutcome): LabOutcome => ({ kind: 'MAP', cause, outcome: channel.run(cause, act) });
  const ret = (cause: LabCause, act: () => ReturnOutcome): LabOutcome => ({ kind: 'RETURN', cause, outcome: channel.run(cause, act) });
  return {
    pan: (translationX, translationY) => map('PAN', () => panByTranslation(store, translationX, translationY)),
    zoom: (direction) => map(direction === 'IN' ? 'ZOOM_IN' : 'ZOOM_OUT', () => zoomSemanticStep(store, direction)),
    tap: (context, node) => {
      const family = node.family;
      if (node.region === 'UNGEOGRAPHIC_REGISTER') return map('INSPECT', () => inspectObject(store, context, { family, id: node.id }));
      const locus = node.locus;
      if (locus !== null && locus.kind === 'CONTEXTUAL_APPEARANCE') {
        return map('DIRECT_JUMP', () => directJump(store, context, { family, id: node.id, appearance: { kind: 'THREAD_READING', bindingId: locus.bindingId } }));
      }
      return map('DIRECT_JUMP', () => directJump(store, context, { family, id: node.id }));
    },
    inspect: (context, family, id) => map('INSPECT', () => inspectObject(store, context, { family, id })),
    returnLiveHead: () => ret('RETURN_LIVE_HEAD', () => returnLiveHead(surface)),
    returnLiveFocus: (context) => ret('RETURN_LIVE_FOCUS', () => returnLiveFocus(surface, { context })),
    goLiveAndLocate: () => ret('GO_LIVE_AND_LOCATE', () => goLiveAndLocate(surface, { liveContext })),
    returnWorld: () => ret('RETURN_WORLD', () => returnWorld(surface)),
    backOneStep: () => ret('BACK_ONE_STEP', () => backOneStep(surface)),
    exactReturn: (target) => ret('EXACT_RETURN', () => exactReturn(surface, target)),
    advanceLive: () => ({ kind: 'LIVE', cause: 'LIVE_ADVANCE', outcome: channel.run('LIVE_ADVANCE', () => advanceLive(store, world)) }),
  };
}

/** A short, honest line about what the store answered, for the harness status readout. */
export function describeOutcome(result: LabOutcome): string {
  const { outcome } = result;
  if (result.kind === 'LIVE') {
    return result.outcome.outcome === 'ADVANCED' ? `live advanced to SP ${result.outcome.toSp}` : `record ends at SP ${result.outcome.liveHead}`;
  }
  if (outcome.outcome === 'APPLIED') {
    const locate = 'locate' in outcome ? ` · ${outcome.locate}` : '';
    const consumed = 'consumed' in outcome && outcome.consumed > 0 ? ` · consumed ${outcome.consumed}` : '';
    return `${result.cause}: applied${locate}${consumed}`;
  }
  if (outcome.outcome === 'NO_OP') {
    const reason = 'reason' in outcome ? ` (${outcome.reason})` : '';
    return `${result.cause}: no-op${reason}`;
  }
  if (outcome.outcome === 'REJECTED') return `${result.cause}: refused ${outcome.code}`;
  if (outcome.outcome === 'CONTEXT_SELECTION_REQUIRED') return `${result.cause}: several legitimate places; nothing elected`;
  return `${result.cause}: ${String((outcome as { outcome: string }).outcome)}`;
}
