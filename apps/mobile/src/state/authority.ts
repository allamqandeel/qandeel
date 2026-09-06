/**
 * T-02 — Per-field Class-A writer authority guard and typed rejections.
 *
 * The guard is the executable form of the Stage 6.5 v3 §11 writer-authority table: after a
 * transition runs, every Class-A field that changed must be inside the acting identity's
 * declared authority, otherwise the write is rejected and the published state stays untouched.
 * It runs on every result, including transitions injected through the store dependencies, so
 * a TypeScript bypass cannot bypass the boundary. The authority it consumes is a frozen
 * readonly array from the immutable registry (FIX-T02-01).
 */
import { CLASS_A_FIELDS, classAFieldEquals, type CanonicalState, type ClassAField } from './classes';

export type CanonicalStateErrorCode =
  | 'UNAUTHORIZED_CLASS_A_WRITE'
  | 'UNAUTHORIZED_ACTION_CLASS'
  | 'UNAUTHORIZED_MAP_ACTION'
  | 'UNAUTHORIZED_TEMPORAL_ACTION'
  | 'UNAUTHORIZED_RETURN_ACTION'
  | 'OWNED_BY_LATER_TASK'
  | 'UNKNOWN_ACTION'
  | 'UNKNOWN_EVENT'
  | 'PRECONDITION_FAILED'
  | 'RETRACTION_REJECTED'
  | 'OUT_OF_ORDER_TRANSITION'
  | 'INVALID_INITIAL_STATE'
  | 'INVALID_CANONICAL_SHAPE'
  | 'IMMUTABLE_CONTEXT_VIOLATION';

export class CanonicalStateError extends Error {
  readonly code: CanonicalStateErrorCode;

  constructor(code: CanonicalStateErrorCode, message: string) {
    super(message);
    this.name = 'CanonicalStateError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A transition changed a Class-A field outside the acting identity's authority. */
export class UnauthorizedClassAWrite extends CanonicalStateError {
  readonly field: ClassAField;
  readonly actId: string;

  constructor(field: ClassAField, actId: string) {
    super('UNAUTHORIZED_CLASS_A_WRITE', `${actId} attempted to write Class-A field ${field} without authority`);
    this.name = 'UnauthorizedClassAWrite';
    this.field = field;
    this.actId = actId;
  }
}

/** A Class C / D identity or an event reached the Product action path, or an action reached ingestion. */
export class UnauthorizedActionClass extends CanonicalStateError {
  readonly id: string;
  readonly cls: string;

  constructor(id: string, cls: string, message: string) {
    super('UNAUTHORIZED_ACTION_CLASS', message);
    this.name = 'UnauthorizedActionClass';
    this.id = id;
    this.cls = cls;
  }
}

/**
 * A promoted Map act reached the store without a runtime authorization from the store's own Map
 * authority (R1-01). Raised for a raw dispatch of a Map act, for a Map act on a store that has no
 * authority at all, and for an act whose authorization the authority refuses or has already
 * consumed. The store never learns WHY the authority refused — it only learns that it did — so no
 * entitlement rule is duplicated here.
 */
export class UnauthorizedMapAction extends CanonicalStateError {
  readonly id: string;

  constructor(id: string, reason: string) {
    super('UNAUTHORIZED_MAP_ACTION', `${id} carries no runtime authorization from this store's Map authority: ${reason}`);
    this.name = 'UnauthorizedMapAction';
    this.id = id;
  }
}

/**
 * A promoted temporal act reached the store without a runtime authorization from the store's own
 * Temporal authority (T-06). Raised for a raw dispatch of a temporal act, for a temporal act on a
 * store that has no such authority at all, and for an act whose authorization the authority refuses
 * or has already consumed. It is deliberately a SEPARATE refusal from the Map one: the two promoted
 * families have separate authorities, so an act minted for one seam can never satisfy the other,
 * and a refusal names which boundary was crossed. The store never learns WHY the authority refused
 * — only that it did — so no locatability or disclosure rule is duplicated here.
 */
export class UnauthorizedTemporalAction extends CanonicalStateError {
  readonly id: string;

  constructor(id: string, reason: string) {
    super('UNAUTHORIZED_TEMPORAL_ACTION', `${id} carries no runtime authorization from this store's Temporal authority: ${reason}`);
    this.name = 'UnauthorizedTemporalAction';
    this.id = id;
  }
}

/**
 * A promoted return act reached the store without a runtime authorization from the store's own
 * Return authority (T-07). Raised for a raw dispatch of a return act, for a return act on a store
 * that has no such authority at all, and for an act whose authorization the authority refuses or has
 * already consumed. It is a THIRD, separate refusal on purpose: the return family has its own
 * authority, so neither the Map owner's nor the temporal owner's mint can satisfy this seam, a
 * return mint cannot satisfy theirs, and a refusal names which boundary was crossed. The store never
 * learns WHY the authority refused — only that it did — so no locatability, disclosure or history
 * rule is duplicated here.
 */
export class UnauthorizedReturnAction extends CanonicalStateError {
  readonly id: string;

  constructor(id: string, reason: string) {
    super('UNAUTHORIZED_RETURN_ACTION', `${id} carries no runtime authorization from this store's Return authority: ${reason}`);
    this.name = 'UnauthorizedReturnAction';
    this.id = id;
  }
}

/** A frozen later-owner act whose substrate does not exist yet. Never a fake no-op. */
export class OwnedByLaterTask extends CanonicalStateError {
  readonly id: string;
  readonly owner: string;

  constructor(id: string, owner: string) {
    super('OWNED_BY_LATER_TASK', `${id} is owned by ${owner} and is not executable in T-02`);
    this.name = 'OwnedByLaterTask';
    this.id = id;
    this.owner = owner;
  }
}

export class UnknownAction extends CanonicalStateError {
  readonly id: string;

  constructor(id: string) {
    super('UNKNOWN_ACTION', `${id} is not a registered Product action identity`);
    this.name = 'UnknownAction';
    this.id = id;
  }
}

export class UnknownEvent extends CanonicalStateError {
  readonly id: string;

  constructor(id: string) {
    super('UNKNOWN_EVENT', `${id} is not a registered authoritative event; the event catalog is closed`);
    this.name = 'UnknownEvent';
    this.id = id;
  }
}

export class PreconditionFailed extends CanonicalStateError {
  readonly id: string;

  constructor(id: string, reason: string) {
    super('PRECONDITION_FAILED', `${id}: ${reason}`);
    this.name = 'PreconditionFailed';
    this.id = id;
  }
}

/** An authoritative `LH` delivery below the mirrored value: an established Moment is never retracted. */
export class RetractionRejected extends CanonicalStateError {
  constructor(message: string) {
    super('RETRACTION_REJECTED', message);
    this.name = 'RetractionRejected';
  }
}

/** An `LF` transition anchored before the mirrored one, or a conflicting value at the same SP. */
export class OutOfOrderTransition extends CanonicalStateError {
  constructor(message: string) {
    super('OUT_OF_ORDER_TRANSITION', message);
    this.name = 'OutOfOrderTransition';
  }
}

export class InvalidInitialState extends CanonicalStateError {
  constructor(message: string) {
    super('INVALID_INITIAL_STATE', message);
    this.name = 'InvalidInitialState';
  }
}

/** A candidate state is not exact-shaped: an unknown or smuggled key, or a malformed nested value (FIX-T02-02). */
export class InvalidCanonicalShape extends CanonicalStateError {
  readonly path: string;

  constructor(issue: string) {
    super('INVALID_CANONICAL_SHAPE', `canonical shape violation: ${issue}`);
    this.name = 'InvalidCanonicalShape';
    this.path = issue;
  }
}

/** A transition or event attempted to change immutable store context such as `session.id` (FIX-T02-02). */
export class ImmutableContextViolation extends CanonicalStateError {
  constructor(message: string) {
    super('IMMUTABLE_CONTEXT_VIOLATION', message);
    this.name = 'ImmutableContextViolation';
  }
}

/**
 * Returns the Class-A fields that differ between `before` and `after`; throws
 * `UnauthorizedClassAWrite` for the first changed field outside `authority`.
 */
export function assertAuthorizedClassAWrites(
  before: CanonicalState,
  after: CanonicalState,
  authority: readonly ClassAField[],
  actId: string,
): readonly ClassAField[] {
  const changed: ClassAField[] = [];
  for (const field of CLASS_A_FIELDS) {
    if (classAFieldEquals(field, before, after)) continue;
    if (!authority.includes(field)) throw new UnauthorizedClassAWrite(field, actId);
    changed.push(field);
  }
  return changed;
}
