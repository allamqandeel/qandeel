/**
 * T-02 — Normalized action identity foundation.
 *
 * Four levels (Execution Authorization §7, §11, §12; T-04 Direct Implementation §3, §18):
 *
 * - KERNEL: the only executable transitions in T-02 — `PAN`, `ZOOM_SEMANTIC`, `COMMIT_MOMENT`,
 *   `COMMIT_LIVE_EDGE`, and the two authoritative mirror ingestions `LIVE_HEAD_ADVANCED` and
 *   `LIVE_FOCUS_TRANSITION`.
 * - EXECUTABLE: a frozen act whose owning task has landed its substrate and has promoted it to
 *   a typed transition through this same boundary. T-04 promotes exactly three by name —
 *   `INSPECT_OBJECT`, `SWITCH_CONTEXT`, `DIRECT_JUMP` — T-06 exactly two more —
 *   `COMMIT_MOMENT_AND_LOCATE`, `CHOOSE_LOCUS` — and T-07 exactly the six frozen return acts —
 *   `RETURN_LIVE_HEAD`, `RETURN_LIVE_FOCUS`, `GO_LIVE_AND_LOCATE`, `RETURN_WORLD`,
 *   `EXACT_RETURN`, `BACK_ONE_STEP` — each keeping its frozen identity, field authority,
 *   transactional category and RH behaviour. The six stay SIX different Product acts: they are
 *   never collapsed into a generic navigate / home / reset / go-live identity.
 * - METADATA_ONLY: frozen later-owner acts recorded as identity, owner, class, permitted
 *   Class-A authority and frozen transactional category. They carry no payload type and fail
 *   closed at the store (`OwnedByLaterTask`). The set is currently EMPTY — every frozen act now
 *   has a landed owner — and the level, with its fail-closed rule, remains for the next one.
 * - NOT_STORE_ACTION: Class C / D identities registered for classification only. They never
 *   reach the store (`UnauthorizedActionClass`).
 *
 * No generic `navigate()`, no `MAP_FOCUS_OBJECT`, no generic world-truth / invalidate / refresh
 * event exists. The event catalog is closed to the two ingestion seams.
 *
 * The authority policy is runtime-immutable (FIX-T02-01): every authority is a frozen readonly
 * array, every entry is frozen and the catalog container is frozen, so no public reference can
 * widen an identity's authority after module initialization.
 */
import type {
  CameraIntent,
  ClassAField,
  InspectionRef,
  LiveFocus,
  RhEntry,
  ScaleIntentRef,
  SemanticDepth,
  SessionPosition,
  SpatialDestinationRef,
  WorldAnchorRef,
  WorldOrientationRef,
} from './classes';

// ------------------------------------------------------------------------------------------
// Kernel actions (Product acts executable in T-02)
// ------------------------------------------------------------------------------------------

/**
 * Abstract authorized pan intent. Produced by the owning gesture interpreter (T-04); the kernel
 * contains no gesture-to-world mathematics. `destination` is written only when supplied
 * (EX02-03).
 */
export interface PanIntent {
  readonly anchor: WorldAnchorRef;
  readonly destination?: SpatialDestinationRef;
}

/** Abstract authorized semantic-zoom intent: optional scale and focal anchor (EX02-03). */
export interface ZoomIntent {
  readonly scale?: ScaleIntentRef;
  readonly anchor?: WorldAnchorRef;
}

export type KernelAction =
  | { readonly type: 'PAN'; readonly to: PanIntent }
  | { readonly type: 'ZOOM_SEMANTIC'; readonly depth: SemanticDepth; readonly to?: ZoomIntent }
  | { readonly type: 'COMMIT_MOMENT'; readonly moment: SessionPosition }
  | { readonly type: 'COMMIT_LIVE_EDGE' };

export type KernelActionType = KernelAction['type'];
export const KERNEL_ACTION_TYPES = Object.freeze(['PAN', 'ZOOM_SEMANTIC', 'COMMIT_MOMENT', 'COMMIT_LIVE_EDGE'] as const);

// ------------------------------------------------------------------------------------------
// Map acts promoted to executable by T-04 (exactly three, by name)
// ------------------------------------------------------------------------------------------

/**
 * Authorized landing of a direct jump. The kernel never resolves a locus: T-04's entitlement
 * layer derives every reference here from the disclosed projection `V` before the act is built.
 * `destination` is mandatory because a direct jump lands in an identified contextual locus;
 * ordinary inspection carries none and can therefore never smuggle a locate.
 */
export interface DirectJumpLanding {
  readonly depth: SemanticDepth;
  readonly anchor: WorldAnchorRef;
  readonly destination: SpatialDestinationRef;
  readonly scale?: ScaleIntentRef;
  readonly orientation?: WorldOrientationRef;
}

export type MapAction =
  | { readonly type: 'INSPECT_OBJECT'; readonly ref: InspectionRef }
  | { readonly type: 'SWITCH_CONTEXT'; readonly ref: InspectionRef }
  | { readonly type: 'DIRECT_JUMP'; readonly ref: InspectionRef; readonly to: DirectJumpLanding };

export type MapActionType = MapAction['type'];
export const MAP_ACTION_TYPES = Object.freeze(['INSPECT_OBJECT', 'SWITCH_CONTEXT', 'DIRECT_JUMP'] as const);

// ------------------------------------------------------------------------------------------
// Temporal acts promoted to executable by T-06 (exactly two, by name)
// ------------------------------------------------------------------------------------------

/**
 * The authorized landing of a composite temporal + locate act, or of a contextual-locus choice.
 * The kernel resolves no locus: T-06 derives every reference here from the disclosed projection of
 * the position the act commits to — through T-04's locatability substrate — before the act is
 * built. `destination` is mandatory because both acts land in exactly ONE identified locus.
 *
 * There is deliberately no `depth`: neither frozen identity holds `MC.depth` authority, so a
 * composite locate can never become a semantic-zoom move, and the landing must therefore have been
 * resolved at the semantic depth the camera already discloses.
 */
export interface LocateLanding {
  readonly anchor: WorldAnchorRef;
  readonly destination: SpatialDestinationRef;
  readonly scale?: ScaleIntentRef;
  readonly orientation?: WorldOrientationRef;
}

export type TemporalAction =
  | { readonly type: 'COMMIT_MOMENT_AND_LOCATE'; readonly moment: SessionPosition; readonly to: LocateLanding }
  | { readonly type: 'CHOOSE_LOCUS'; readonly to: LocateLanding };

export type TemporalActionType = TemporalAction['type'];
export const TEMPORAL_ACTION_TYPES = Object.freeze(['COMMIT_MOMENT_AND_LOCATE', 'CHOOSE_LOCUS'] as const);

// ------------------------------------------------------------------------------------------
// Return acts promoted to executable by T-07 (exactly six, by name)
// ------------------------------------------------------------------------------------------

/**
 * The six frozen return identities, and only these six. They are deliberately SIX payload shapes,
 * not one: each carries exactly what its own frozen authority may write and nothing more, so no
 * shared shape can widen one act into another.
 *
 * - `RETURN_LIVE_HEAD` carries nothing at all: it is temporal-only, and a payload would be a way
 *   to smuggle a camera move into it.
 * - `RETURN_LIVE_FOCUS` carries a `LocateLanding` — no depth, because it does not hold `MC.depth`.
 * - `GO_LIVE_AND_LOCATE` carries an OPTIONAL landing, because a legitimate P5 whose spatial part
 *   cannot move is still ONE composite act with its temporal part intact.
 * - `RETURN_WORLD` carries the canonical World/Z0 camera intent T-04 already owns; it is resolved
 *   by the return layer from that one existing helper and never invented here.
 * - `EXACT_RETURN` and `BACK_ONE_STEP` carry the RH ENTRY they restore FROM — the object itself,
 *   not a caller-built checkpoint payload. The store locates it by identity in its OWN current
 *   history, so a structurally perfect forgery, a copy, a round-trip and an already-consumed
 *   target all fail before any state is written.
 */
export type ReturnAction =
  | { readonly type: 'RETURN_LIVE_HEAD' }
  | { readonly type: 'RETURN_LIVE_FOCUS'; readonly to: LocateLanding }
  | { readonly type: 'GO_LIVE_AND_LOCATE'; readonly to?: LocateLanding }
  | { readonly type: 'RETURN_WORLD'; readonly to: CameraIntent }
  | { readonly type: 'EXACT_RETURN'; readonly target: RhEntry }
  | { readonly type: 'BACK_ONE_STEP'; readonly target: RhEntry };

export type ReturnActionType = ReturnAction['type'];
export const RETURN_ACTION_TYPES = Object.freeze([
  'RETURN_LIVE_HEAD',
  'RETURN_LIVE_FOCUS',
  'GO_LIVE_AND_LOCATE',
  'RETURN_WORLD',
  'EXACT_RETURN',
  'BACK_ONE_STEP',
] as const);

/** The two identities whose frozen transactional category is `CONSUMES_RH`; nothing else may reduce RH. */
export const RH_CONSUMING_ACTION_TYPES = Object.freeze(['EXACT_RETURN', 'BACK_ONE_STEP'] as const);
export type RhConsumingActionType = (typeof RH_CONSUMING_ACTION_TYPES)[number];

/**
 * Every Product act the store can execute: the T-02 kernel, the three T-04 Map acts, the two T-06
 * temporal acts, the six T-07 return acts.
 */
export type StoreAction = KernelAction | MapAction | TemporalAction | ReturnAction;
export type StoreActionType = StoreAction['type'];

// ------------------------------------------------------------------------------------------
// Authoritative events (passive, server-originated; closed catalog)
// ------------------------------------------------------------------------------------------

export type AuthoritativeEvent =
  | { readonly type: 'LIVE_HEAD_ADVANCED'; readonly toSp: SessionPosition }
  | { readonly type: 'LIVE_FOCUS_TRANSITION'; readonly value: LiveFocus; readonly atSp: SessionPosition };

export type AuthoritativeEventType = AuthoritativeEvent['type'];
export const AUTHORITATIVE_EVENT_TYPES = Object.freeze(['LIVE_HEAD_ADVANCED', 'LIVE_FOCUS_TRANSITION'] as const);

// ------------------------------------------------------------------------------------------
// Later-owner identities (metadata only) and non-store identities (Class C / D)
// ------------------------------------------------------------------------------------------

/**
 * Frozen acts whose owning task has not landed yet. T-07 promoted the last six members of this
 * set into the executable return family, so it is currently EMPTY — deliberately kept, with the
 * store's `OwnedByLaterTask` rule stated over the LEVEL rather than per identity, so the next
 * frozen later-owner act fails closed the moment it is registered.
 */
export const METADATA_ONLY_ACTION_TYPES = Object.freeze([] as const);
export type MetadataOnlyActionType = (typeof METADATA_ONLY_ACTION_TYPES)[number];

export const NON_STORE_IDENTITY_TYPES = Object.freeze([
  'PREVIEW_TEMPORAL_TARGET',
  'CANCEL_PREVIEW',
  'RELATIVE_FORWARD_CONTINUATION',
  'INPUT_CANCELLATION',
  'PRESENTATION_WINDOW_MOVE',
  'PRESENTATION_POSITION_MOVE',
  'PRESENTATION_POSITION_REFINE',
  'PRESENTATION_POSITION_WIDEN',
  'RESPONSIVE_RECOMPOSITION',
  'REDUCED_MOTION_PREFERENCE',
] as const);
export type NonStoreIdentityType = (typeof NON_STORE_IDENTITY_TYPES)[number];

/** Every registered identity, of every level and class. */
export type ProductActId =
  | KernelActionType
  | MapActionType
  | TemporalActionType
  | ReturnActionType
  | AuthoritativeEventType
  | MetadataOnlyActionType
  | NonStoreIdentityType;

/**
 * RH-eligible identities (FIX-T02-03): explicit Class-A Product acts only. Authoritative
 * events and Class C / D identities are unrepresentable as an RH act. The three T-04 Map acts,
 * the two T-06 temporal acts and the four APPENDING T-07 return acts append at the existing
 * effective-transaction boundary — exactly one entry per effective act, composite included.
 *
 * `EXACT_RETURN` and `BACK_ONE_STEP` stay RH-eligible in TYPE, because a persisted history from
 * an earlier release may legitimately record either identity, but neither is ever appended: their
 * frozen transactional category is `CONSUMES_RH`, and the consumption path appends nothing.
 */
export type RhActionId = KernelActionType | MapActionType | TemporalActionType | ReturnActionType | MetadataOnlyActionType;
export const RH_ACTION_IDS: readonly RhActionId[] = Object.freeze([
  ...KERNEL_ACTION_TYPES,
  ...MAP_ACTION_TYPES,
  ...TEMPORAL_ACTION_TYPES,
  ...RETURN_ACTION_TYPES,
  ...METADATA_ONLY_ACTION_TYPES,
]);

export function isRhActionId(value: unknown): value is RhActionId {
  return typeof value === 'string' && (RH_ACTION_IDS as readonly string[]).includes(value);
}

export type TaskId = 'T-02' | 'T-03A2' | 'T-03D' | 'T-04' | 'T-05' | 'T-06' | 'T-07' | 'T-10' | 'T-11';
export const FROZEN_TASK_IDS: readonly TaskId[] = Object.freeze(['T-02', 'T-03A2', 'T-03D', 'T-04', 'T-05', 'T-06', 'T-07', 'T-10', 'T-11']);

export type CatalogClass = 'A' | 'C' | 'D' | 'EVENT';
export type CatalogLevel = 'KERNEL' | 'EXECUTABLE' | 'METADATA_ONLY' | 'NOT_STORE_ACTION';
/** The levels the store runs a transition for; every other level fails closed. */
export const EXECUTABLE_CATALOG_LEVELS: readonly CatalogLevel[] = Object.freeze(['KERNEL', 'EXECUTABLE']);
export type TransactionalCategory =
  | 'EFFECTIVE_TRANSACTION'
  | 'COMPOSITE_TRANSACTION'
  | 'RH_CHECKPOINT'
  | 'CONSUMES_RH'
  | 'NEVER';

export interface CatalogEntry {
  readonly id: ProductActId;
  readonly frozenName: string;
  readonly cls: CatalogClass;
  readonly level: CatalogLevel;
  /** Task that owns the identity's full behaviour (T-02 for kernel transitions). */
  readonly owner: TaskId;
  /** Task that owns the substrate or mechanics around a kernel transition, if any. */
  readonly substrateOwner: TaskId | null;
  /** Permitted Class-A authority: a frozen readonly array, never a mutable collection. */
  readonly authority: readonly ClassAField[];
  readonly transactional: TransactionalCategory;
  readonly frozenSource: string;
}

function fields(...names: readonly ClassAField[]): readonly ClassAField[] {
  return Object.freeze([...names]);
}

const SPATIAL = ['MC.anchor', 'MC.orientation', 'MC.scale', 'MC.destination'] as const;

function freezeCatalog<T extends Record<string, CatalogEntry>>(catalog: T): Readonly<T> {
  for (const key of Object.keys(catalog)) Object.freeze(catalog[key]);
  return Object.freeze(catalog);
}

export const ACTION_CATALOG: Readonly<Record<ProductActId, CatalogEntry>> = freezeCatalog({
  // --- KERNEL: executable Product acts -----------------------------------------------------
  PAN: {
    id: 'PAN',
    frozenName: 'Pan',
    cls: 'A',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-04',
    authority: fields('MC.anchor', 'MC.destination'),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'Stage 4.1; S34-WORLD-04; S5-RH-02/04; EX02-03',
  },
  ZOOM_SEMANTIC: {
    id: 'ZOOM_SEMANTIC',
    frozenName: 'Semantic Zoom',
    cls: 'A',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-04',
    authority: fields('MC.depth', 'MC.scale', 'MC.anchor'),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'Stage 4.2; S34-WORLD-03; S5-RH-02/04; EX02-03',
  },
  COMMIT_MOMENT: {
    id: 'COMMIT_MOMENT',
    frozenName: 'Commit Moment(m) → PINNED(m)',
    cls: 'A',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-06',
    authority: fields('TM'),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-TL-02; Stage 5.2 §2.5 (REV-02); Execution Authorization §7',
  },
  COMMIT_LIVE_EDGE: {
    id: 'COMMIT_LIVE_EDGE',
    frozenName: 'Commit LIVE_EDGE → FOLLOW_LIVE',
    cls: 'A',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-06',
    authority: fields('TM'),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-TL-02; Stage 5.2 §2.5; EX02-02',
  },
  // --- KERNEL: authoritative mirror ingestions ---------------------------------------------
  LIVE_HEAD_ADVANCED: {
    id: 'LIVE_HEAD_ADVANCED',
    frozenName: 'Authoritative committed-CU advancement (LH)',
    cls: 'EVENT',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-03A2',
    authority: fields('LH'),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 MOM-06; S5-RH-05',
  },
  LIVE_FOCUS_TRANSITION: {
    id: 'LIVE_FOCUS_TRANSITION',
    frozenName: 'Authoritative Live Focus transition (LF)',
    cls: 'EVENT',
    level: 'KERNEL',
    owner: 'T-02',
    substrateOwner: 'T-03D',
    authority: fields('LF'),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 SDM-04 LF-01…04; S5-RH-05',
  },
  // --- EXECUTABLE: the three Map acts T-04 promoted (frozen identities unchanged) ----------
  INSPECT_OBJECT: {
    id: 'INSPECT_OBJECT',
    frozenName: 'Inspection transition (Stage 4)',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-04',
    substrateOwner: null,
    authority: fields('IF_ref'),
    transactional: 'RH_CHECKPOINT',
    frozenSource: 'Stage 4.1/4.3; Stage 5.2 §2.7 checkpoint',
  },
  SWITCH_CONTEXT: {
    id: 'SWITCH_CONTEXT',
    frozenName: 'Context switching (same object, different appearance)',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-04',
    substrateOwner: null,
    authority: fields('IF_ref'),
    transactional: 'RH_CHECKPOINT',
    frozenSource: 'Stage 4.3; Stage 5.2 §2.7 checkpoint',
  },
  DIRECT_JUMP: {
    id: 'DIRECT_JUMP',
    frozenName: 'Direct addressability / direct jump',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-04',
    substrateOwner: null,
    authority: fields('IF_ref', 'MC.depth', ...SPATIAL),
    transactional: 'RH_CHECKPOINT',
    frozenSource: 'Stage 4.1/4.3; Stage 5.2 §2.7 checkpoint',
  },
  // --- EXECUTABLE: the two temporal acts T-06 promoted (frozen identities unchanged) --------
  COMMIT_MOMENT_AND_LOCATE: {
    id: 'COMMIT_MOMENT_AND_LOCATE',
    frozenName: 'P3a Temporal + Locate',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-06',
    substrateOwner: 'T-04',
    authority: fields('TM', ...SPATIAL),
    transactional: 'COMPOSITE_TRANSACTION',
    frozenSource: 'Stage 5.2 §3.2 P3a, REV-05, FREEZE-03; S5-TL-06',
  },
  CHOOSE_LOCUS: {
    id: 'CHOOSE_LOCUS',
    frozenName: 'Contextual-locus choice (D4)',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-06',
    substrateOwner: 'T-04',
    authority: fields(...SPATIAL),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-RET-07; Stage 5.5 D4; CLAR-03',
  },
  // --- EXECUTABLE: the six return acts T-07 promoted (frozen identities unchanged) ---------
  RETURN_LIVE_HEAD: {
    id: 'RETURN_LIVE_HEAD',
    frozenName: 'P4 Return to Live Head',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: null,
    authority: fields('TM'),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-RET-03; Stage 5.5 D3/D5; Stage 5.2 P4',
  },
  RETURN_LIVE_FOCUS: {
    id: 'RETURN_LIVE_FOCUS',
    frozenName: 'Return to Live Focus (D1)',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: 'T-03D',
    authority: fields(...SPATIAL),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-RET-04; Stage 5.5 D1; Stage 6.5 v3 §11',
  },
  GO_LIVE_AND_LOCATE: {
    id: 'GO_LIVE_AND_LOCATE',
    frozenName: 'P5 Go Live + Locate',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: 'T-03D',
    authority: fields('TM', ...SPATIAL),
    transactional: 'COMPOSITE_TRANSACTION',
    frozenSource: 'S5-RET-06; AMB-01 post-live one-shot binding; Stage 5.2 P5',
  },
  RETURN_WORLD: {
    id: 'RETURN_WORLD',
    frozenName: 'Return to World',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: null,
    authority: fields('MC.depth', ...SPATIAL),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-RET-05; Stage 6.5 v3 §21A',
  },
  EXACT_RETURN: {
    id: 'EXACT_RETURN',
    frozenName: 'P7 Exact Return / Original Inspection',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: null,
    authority: fields('TM', 'IF_ref', 'MC.depth', ...SPATIAL),
    transactional: 'CONSUMES_RH',
    frozenSource: 'S5-RET-02; S5-RH-01; Stage 5.2 FREEZE-01',
  },
  BACK_ONE_STEP: {
    id: 'BACK_ONE_STEP',
    frozenName: 'P8 Back One Step',
    cls: 'A',
    level: 'EXECUTABLE',
    owner: 'T-07',
    substrateOwner: null,
    authority: fields('TM', 'IF_ref', 'MC.depth', ...SPATIAL),
    transactional: 'CONSUMES_RH',
    frozenSource: 'S5-RET-01; Stage 5.2 P8, FREEZE-01, REV-05',
  },
  // --- NOT_STORE_ACTION: Class C / D identities (classification only) ----------------------
  PREVIEW_TEMPORAL_TARGET: {
    id: 'PREVIEW_TEMPORAL_TARGET',
    frozenName: 'P1 Scrub / Preview temporal target (PTC)',
    cls: 'C',
    level: 'NOT_STORE_ACTION',
    owner: 'T-06',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'S5-TL-03; Stage 5.2 §2.3, P1',
  },
  CANCEL_PREVIEW: {
    id: 'CANCEL_PREVIEW',
    frozenName: 'P6 Cancel Preview',
    cls: 'C',
    level: 'NOT_STORE_ACTION',
    owner: 'T-06',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'S5-TL-04; Stage 5.2 P6 (REV-07)',
  },
  RELATIVE_FORWARD_CONTINUATION: {
    id: 'RELATIVE_FORWARD_CONTINUATION',
    frozenName: 'Relative forward continuation (incl. long-hold)',
    cls: 'C',
    level: 'NOT_STORE_ACTION',
    owner: 'T-06',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.2 v2 TL-18; Stage 6.4 AX4-06',
  },
  INPUT_CANCELLATION: {
    id: 'INPUT_CANCELLATION',
    frozenName: 'Input-stream cancellation',
    cls: 'C',
    level: 'NOT_STORE_ACTION',
    owner: 'T-06',
    substrateOwner: 'T-11',
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.4 v2 IN-10B, X64-06B',
  },
  PRESENTATION_WINDOW_MOVE: {
    id: 'PRESENTATION_WINDOW_MOVE',
    frozenName: 'Timeline presentation-window navigation',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-05',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 §18–§19; REV64-AT-01',
  },
  PRESENTATION_POSITION_MOVE: {
    id: 'PRESENTATION_POSITION_MOVE',
    frozenName: 'Disclosed-presentation position move',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-05',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 §20A',
  },
  PRESENTATION_POSITION_REFINE: {
    id: 'PRESENTATION_POSITION_REFINE',
    frozenName: 'Disclosed-presentation position refine',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-05',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 §20A',
  },
  PRESENTATION_POSITION_WIDEN: {
    id: 'PRESENTATION_POSITION_WIDEN',
    frozenName: 'Disclosed-presentation position widen',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-05',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.5 v3 §20A',
  },
  RESPONSIVE_RECOMPOSITION: {
    id: 'RESPONSIVE_RECOMPOSITION',
    frozenName: 'Responsive recomposition (layout event)',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-11',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.4 v2 RC-P3, IN-10C; Stage 6.5 v3 §24',
  },
  REDUCED_MOTION_PREFERENCE: {
    id: 'REDUCED_MOTION_PREFERENCE',
    frozenName: 'Reduced-motion preference / effect',
    cls: 'D',
    level: 'NOT_STORE_ACTION',
    owner: 'T-10',
    substrateOwner: null,
    authority: fields(),
    transactional: 'NEVER',
    frozenSource: 'Stage 6.4 v2 MO-R4, IN-11',
  },
});

export const PRODUCT_ACT_IDS: readonly ProductActId[] = Object.freeze(Object.keys(ACTION_CATALOG) as ProductActId[]);

/** Registry lookup that never throws; unknown identities (including `NAVIGATE`) yield `undefined`. */
export function catalogEntry(id: unknown): CatalogEntry | undefined {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ACTION_CATALOG, id)) return undefined;
  return ACTION_CATALOG[id as ProductActId];
}
