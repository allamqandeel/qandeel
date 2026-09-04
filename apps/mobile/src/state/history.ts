/**
 * T-02 — RH transaction boundary: `Φ_eff`, `C_RH` capture and the append rule.
 *
 * Frozen authority: S5-RH-02 (`Φ_eff = ⟨TM, TC, IF_ref, MC.region, MC.depth⟩`; mode counts),
 * S5-RH-03 (`C_RH` payload), S5-RH-04 (true no-op → no RH), S5-RH-05 (passive events never
 * write RH), S5-RH-01 (`RestoreTemporal(entry) := PINNED(entry.capturedTC)`), Execution
 * Authorization §8, Targeted Fix R1 FIX-T02-03/04. `Φ_eff` compares canonical navigation
 * intent only: no device geometry, footprint, animation state, `PTC`, presentation window or
 * focus proxy.
 *
 * Only an RH-eligible explicit Product act may be recorded, and only when the pre-act
 * effective `TC` is an addressable Session Position: an effective act over the technical
 * absence sentinel (`LH = null`) fails closed here, at the common boundary, so no checkpoint
 * that frozen restoration could not honour can ever exist.
 *
 * Consumption of RH (Back One Step, Exact Return, the return acts) is T-07's; nothing here
 * unwinds an entry.
 */
import type { RhActionId } from './actions';
import { PreconditionFailed } from './authority';
import {
  cameraIntentEquals,
  inspectionRefEquals,
  temporalModeEquals,
  type CameraIntent,
  type CanonicalState,
  type InspectionRef,
  type RhEntry,
  type SessionPosition,
  type TemporalMode,
} from './classes';
import { effectiveTC } from './selectors';

export interface PhiEff {
  readonly tm: TemporalMode;
  readonly tc: SessionPosition | null;
  readonly ifRef: InspectionRef | null;
  readonly camera: CameraIntent;
}

export function phiEff(state: CanonicalState): PhiEff {
  return { tm: state.temporal, tc: effectiveTC(state), ifRef: state.inspection, camera: state.camera };
}

/** Mode counts as an effective difference even at equal temporal coordinates (S5-RH-02). */
export function phiEffEquals(a: PhiEff, b: PhiEff): boolean {
  return (
    temporalModeEquals(a.tm, b.tm) &&
    a.tc === b.tc &&
    inspectionRefEquals(a.ifRef, b.ifRef) &&
    cameraIntentEquals(a.camera, b.camera)
  );
}

export function isEffectiveChange(before: CanonicalState, after: CanonicalState): boolean {
  return !phiEffEquals(phiEff(before), phiEff(after));
}

/**
 * Exact pre-act checkpoint (`C_RH`). `tmProvenance` is provenance only; restoration is T-07's.
 * Fails closed when the pre-act effective `TC` is the technical absence sentinel (FIX-T02-04).
 */
export function captureCheckpoint(preActState: CanonicalState, act: RhActionId): RhEntry {
  const tc = effectiveTC(preActState);
  if (tc === null) {
    throw new PreconditionFailed(
      act,
      'no authoritative committed Session Position has been mirrored (LH = null); an effective act cannot be recorded in RH before SP(1)',
    );
  }
  return {
    act,
    captured: {
      tmProvenance: preActState.temporal,
      tc,
      ifRef: preActState.inspection,
      camera: preActState.camera,
    },
  };
}

export interface AppendResult {
  readonly history: readonly RhEntry[];
  readonly entry: RhEntry | null;
}

/**
 * One RH append for one effective explicit Product transaction; nothing for a true no-op.
 * A true no-op stays a no-op even before SP(1); an effective act before SP(1) fails closed.
 */
export function appendIfEffective(before: CanonicalState, after: CanonicalState, act: RhActionId): AppendResult {
  if (!isEffectiveChange(before, after)) return { history: before.history, entry: null };
  const entry = captureCheckpoint(before, act);
  return { history: [...before.history, entry], entry };
}
