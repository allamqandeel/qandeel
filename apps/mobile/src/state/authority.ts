/**
 * T-02 — Per-field Class-A writer authority guard and typed rejections.
 *
 * The guard is the executable form of the Stage 6.5 v3 §11 writer-authority table: after a
 * transition runs, every Class-A field that changed must be inside the acting identity's
 * declared authority, otherwise the write is rejected and the published state stays untouched.
 * It runs on every result, including transitions injected through the store dependencies, so
 * a TypeScript bypass cannot bypass the boundary.
 */
import { CLASS_A_FIELDS, classAFieldEquals, type CanonicalState, type ClassAField } from './classes';

export type CanonicalStateErrorCode =
  | 'UNAUTHORIZED_CLASS_A_WRITE'
  | 'UNAUTHORIZED_ACTION_CLASS'
  | 'OWNED_BY_LATER_TASK'
  | 'UNKNOWN_ACTION'
  | 'UNKNOWN_EVENT'
  | 'PRECONDITION_FAILED'
  | 'RETRACTION_REJECTED'
  | 'OUT_OF_ORDER_TRANSITION'
  | 'INVALID_INITIAL_STATE';

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

/**
 * Returns the Class-A fields that differ between `before` and `after`; throws
 * `UnauthorizedClassAWrite` for the first changed field outside `authority`.
 */
export function assertAuthorizedClassAWrites(
  before: CanonicalState,
  after: CanonicalState,
  authority: ReadonlySet<ClassAField>,
  actId: string,
): readonly ClassAField[] {
  const changed: ClassAField[] = [];
  for (const field of CLASS_A_FIELDS) {
    if (classAFieldEquals(field, before, after)) continue;
    if (!authority.has(field)) throw new UnauthorizedClassAWrite(field, actId);
    changed.push(field);
  }
  return changed;
}
