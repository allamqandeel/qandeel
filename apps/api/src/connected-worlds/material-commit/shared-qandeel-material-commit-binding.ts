// I-04G Independent Review FIX-B - the QANDEEL material commit evidence binder.
//
// ## Why this exists at all
//
// Migration 0090's QANDEEL commit core recomputes, in SQL, the I-03G readiness
// fingerprint and the canonical I-03D audience fingerprint. That proves two real
// things: the supplied references are internally self-consistent, and the
// audience they name is the CURRENT audience of the EXACT World being committed
// into - which is what makes cross-World evidence reuse fail at the database
// boundary, because the frozen I-03D fingerprint carries the World id.
//
// What SQL cannot see is the I-03F result itself. `authorityRevalidationRef`
// reaches the core as an opaque string, so SQL can prove that the readiness
// fingerprint derives from it, but not that the revalidation behind it was
// performed for this World, this output and this audience.
//
// Duplicating the I-03F engine in SQL to recover that would be the wrong trade:
// it would fork a frozen boundary into a second implementation that has to be
// kept in step forever. So this is the narrow alternative the I-04G task
// contract permits - a server-internal adapter that consumes the ALREADY FROZEN
// typed I-03F and I-03G results and refuses to produce commit inputs unless
// every one of them describes the same operation, the same output and the same
// World.
//
// ## What it is not
//
// It is NOT registered in any NestJS module, exports no provider, controller,
// route or RPC, and is imported by nothing. It is a pure function over frozen
// types: it reads no database, performs no I/O, holds no state and makes no
// authority decision of its own. It cannot widen anything - it can only refuse
// to assemble a commit input that the two frozen boundaries do not jointly
// support.
//
// It manufactures no Safety and no Launch clearance. Both frozen results say
// `NOT_EVALUATED` about those, and this adapter neither reads nor restates them:
// CW2-08 owns them, and `READY_FOR_LATER_DELIVERY_GATES` remains exactly what
// I-03G froze it to mean - not System/Safety clearance, not Launch Gate
// clearance, and not delivery or commit permission.
//
// The database remains the authority. Nothing here is trusted by migration 0090:
// the core independently recomputes the output digest, the readiness fingerprint
// and the current audience fingerprint, and refuses the commit on its own if any
// of them disagrees. This adapter exists so that a caller cannot ASSEMBLE a
// coherent-looking request out of evidence that belonged to another operation in
// the first place.

import type { SharedDeliveryAuthorityRevalidation } from '../delivery-authority/shared-delivery-authority.types';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import type { SharedPrivacyAuthorityDeliveryReadiness } from '../source-disclosure/shared-source-disclosure.types';

/** The two QANDEEL material kinds I-04G implements a producer for. */
export const QANDEEL_MATERIAL_KINDS = ['QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS'] as const;
export type QandeelMaterialKind = (typeof QANDEEL_MATERIAL_KINDS)[number];

/**
 * Why a commit input could not be assembled.
 *
 * Every reason is a bounded internal class. None names a participant, a grant, a
 * private source, an owner or any content, and none is user-facing text
 * (CW2-02 §47, B33).
 */
export const SHARED_QANDEEL_COMMIT_BINDING_REFUSALS = [
  'AUTHORITY_NOT_CURRENT',
  'READINESS_NOT_READY',
  'WORLD_MISMATCH',
  'OUTPUT_MISMATCH',
  'OPERATION_MISMATCH',
  'AUDIENCE_MISMATCH',
  'MALFORMED_DEPENDENCIES',
] as const;
export type SharedQandeelCommitBindingRefusal = (typeof SHARED_QANDEEL_COMMIT_BINDING_REFUSALS)[number];

/**
 * Exactly the arguments migration 0090's
 * `commit_shared_world_qandeel_material_v1` takes, in its own vocabulary. No
 * actor, no viewer list, no approver, no count, no instant and no gate state is
 * representable here, because none of those is a caller input.
 */
export interface SharedQandeelMaterialCommitInput {
  readonly worldId: string;
  readonly materialKind: QandeelMaterialKind;
  readonly bodyText: string;
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly sourceDisclosureGateRef: string;
  readonly authorityRevalidationRef: string;
  readonly readinessRef: string;
  readonly audienceSnapshotRef: string;
  readonly materialSourceIds: ReadonlyArray<string>;
  readonly reasoningSourceRefs: ReadonlyArray<string>;
}

export type SharedQandeelMaterialCommitBinding =
  | { readonly state: 'BOUND'; readonly input: SharedQandeelMaterialCommitInput }
  | { readonly state: 'REFUSED'; readonly reason: SharedQandeelCommitBindingRefusal };

/** The opaque-reference shape migration 0089 enforces on a persisted private context reference. */
const OPAQUE_REFERENCE = /^\S{1,200}$/u;

function refused(reason: SharedQandeelCommitBindingRefusal): SharedQandeelMaterialCommitBinding {
  return Object.freeze({ state: 'REFUSED', reason } as const);
}

/** An exact SET: no blank member, and no repeated member. */
function isExactSet(values: ReadonlyArray<string>, shape: RegExp): boolean {
  if (values.some((value) => typeof value !== 'string' || !shape.test(value))) return false;
  return new Set(values).size === values.length;
}

/**
 * Assembles the commit input for one QANDEEL material, or refuses.
 *
 * `currentAudienceSnapshotRef` is the canonical I-03D fingerprint of the World's
 * CURRENT audience. Migration 0090 recomputes it for itself under the World lock
 * and refuses a stale one, so passing a stale value here cannot smuggle anything
 * past the database - it only fails earlier, with a clearer reason.
 */
export function bindSharedQandeelMaterialCommit(request: {
  readonly targetWorldId: string;
  readonly materialKind: QandeelMaterialKind;
  readonly outputText: string;
  readonly currentAudienceSnapshotRef: string;
  readonly revalidation: SharedDeliveryAuthorityRevalidation;
  readonly readiness: SharedPrivacyAuthorityDeliveryReadiness;
  readonly materialSourceIds: ReadonlyArray<string>;
  readonly reasoningSourceRefs: ReadonlyArray<string>;
}): SharedQandeelMaterialCommitBinding {
  // Both frozen boundaries must have SUCCEEDED. STALE and UNRESOLVED both block,
  // and neither is collapsed into the other or into a refusal that suggests
  // regenerating will help when it will not.
  if (request.revalidation.state !== 'CURRENT') return refused('AUTHORITY_NOT_CURRENT');
  if (request.readiness.state !== 'READY_FOR_LATER_DELIVERY_GATES') return refused('READINESS_NOT_READY');
  const authority = request.revalidation.revalidation;
  const readiness = request.readiness.readiness;

  // THE WORLD. This is the half migration 0090 cannot see for itself: the I-03F
  // result names the exact World its revalidation was performed for, and evidence
  // for another World is refused here even when the body bytes are identical and
  // the other World currently has a perfectly valid audience.
  if (authority.targetWorldId !== request.targetWorldId) return refused('WORLD_MISMATCH');

  // THE EXACT OUTPUT. Both boundaries must be about these exact bytes, computed
  // with the frozen I-03F convention rather than trusted from either result.
  const outputDigest = digestProviderOutput(request.outputText);
  if (authority.outputDigest !== outputDigest) return refused('OUTPUT_MISMATCH');
  if (readiness.outputDigest !== outputDigest) return refused('OUTPUT_MISMATCH');

  // THE SAME OPERATION. The readiness must rest on THIS revalidation, and both
  // must name the same generation envelope. "Compatible" is not a relation this
  // binder has.
  if (authority.effectiveContextRef !== readiness.effectiveContextRef) return refused('OPERATION_MISMATCH');
  if (readiness.authorityRevalidationRef !== authority.revalidationRef) return refused('OPERATION_MISMATCH');

  // THE SAME AUDIENCE. The revalidation found authority current against one exact
  // audience snapshot; committing against a different one would deliver to an
  // audience nothing was revalidated for.
  if (authority.audienceSnapshotRef !== request.currentAudienceSnapshotRef) return refused('AUDIENCE_MISMATCH');

  // The dependency selections are exact sets, and a reasoning reference is an
  // opaque server-owned identity - never raw private prose, which is also what
  // migration 0089 structurally enforces on the persisted row.
  if (!isExactSet(request.materialSourceIds, OPAQUE_REFERENCE)) return refused('MALFORMED_DEPENDENCIES');
  if (!isExactSet(request.reasoningSourceRefs, OPAQUE_REFERENCE)) return refused('MALFORMED_DEPENDENCIES');

  return Object.freeze({
    state: 'BOUND',
    input: Object.freeze({
      worldId: request.targetWorldId,
      materialKind: request.materialKind,
      bodyText: request.outputText,
      effectiveContextRef: readiness.effectiveContextRef,
      outputDigest,
      sourceDisclosureGateRef: readiness.sourceDisclosureGateRef,
      authorityRevalidationRef: readiness.authorityRevalidationRef,
      readinessRef: readiness.readinessRef,
      audienceSnapshotRef: authority.audienceSnapshotRef,
      materialSourceIds: Object.freeze([...request.materialSourceIds]),
      reasoningSourceRefs: Object.freeze([...request.reasoningSourceRefs]),
    } as const),
  } as const);
}
