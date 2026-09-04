/**
 * T-02 — Normalized action identity foundation.
 *
 * Two levels (Execution Authorization §7, §11, §12):
 *
 * - KERNEL: the only executable transitions in T-02 — `PAN`, `ZOOM_SEMANTIC`, `COMMIT_MOMENT`,
 *   `COMMIT_LIVE_EDGE`, and the two authoritative mirror ingestions `LIVE_HEAD_ADVANCED` and
 *   `LIVE_FOCUS_TRANSITION`.
 * - METADATA_ONLY: frozen later-owner acts recorded as identity, owner, class, permitted
 *   Class-A authority and frozen transactional category. They carry no payload type and fail
 *   closed at the store (`OwnedByLaterTask`).
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
  ClassAField,
  LiveFocus,
  ScaleIntentRef,
  SemanticDepth,
  SessionPosition,
  SpatialDestinationRef,
  WorldAnchorRef,
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

export const METADATA_ONLY_ACTION_TYPES = Object.freeze([
  'COMMIT_MOMENT_AND_LOCATE',
  'CHOOSE_LOCUS',
  'RETURN_LIVE_HEAD',
  'RETURN_LIVE_FOCUS',
  'GO_LIVE_AND_LOCATE',
  'RETURN_WORLD',
  'EXACT_RETURN',
  'BACK_ONE_STEP',
  'INSPECT_OBJECT',
  'SWITCH_CONTEXT',
  'DIRECT_JUMP',
] as const);
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
export type ProductActId = KernelActionType | AuthoritativeEventType | MetadataOnlyActionType | NonStoreIdentityType;

/**
 * RH-eligible identities (FIX-T02-03): explicit Class-A Product acts only. Authoritative
 * events and Class C / D identities are unrepresentable as an RH act. Later-owner acts are
 * eligible in type because their RH behaviour is frozen and owned later; T-02 never appends them.
 */
export type RhActionId = KernelActionType | MetadataOnlyActionType;
export const RH_ACTION_IDS: readonly RhActionId[] = Object.freeze([...KERNEL_ACTION_TYPES, ...METADATA_ONLY_ACTION_TYPES]);

export function isRhActionId(value: unknown): value is RhActionId {
  return typeof value === 'string' && (RH_ACTION_IDS as readonly string[]).includes(value);
}

export type TaskId = 'T-02' | 'T-03A2' | 'T-03D' | 'T-04' | 'T-05' | 'T-06' | 'T-07' | 'T-10' | 'T-11';
export const FROZEN_TASK_IDS: readonly TaskId[] = Object.freeze(['T-02', 'T-03A2', 'T-03D', 'T-04', 'T-05', 'T-06', 'T-07', 'T-10', 'T-11']);

export type CatalogClass = 'A' | 'C' | 'D' | 'EVENT';
export type CatalogLevel = 'KERNEL' | 'METADATA_ONLY' | 'NOT_STORE_ACTION';
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
  // --- METADATA_ONLY: frozen later-owner acts (no payload types; fail closed) --------------
  COMMIT_MOMENT_AND_LOCATE: {
    id: 'COMMIT_MOMENT_AND_LOCATE',
    frozenName: 'P3a Temporal + Locate',
    cls: 'A',
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
    owner: 'T-06',
    substrateOwner: 'T-04',
    authority: fields(...SPATIAL),
    transactional: 'EFFECTIVE_TRANSACTION',
    frozenSource: 'S5-RET-07; Stage 5.5 D4; CLAR-03',
  },
  RETURN_LIVE_HEAD: {
    id: 'RETURN_LIVE_HEAD',
    frozenName: 'P4 Return to Live Head',
    cls: 'A',
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
    owner: 'T-07',
    substrateOwner: null,
    authority: fields('TM', 'IF_ref', 'MC.depth', ...SPATIAL),
    transactional: 'CONSUMES_RH',
    frozenSource: 'S5-RET-01; Stage 5.2 P8, FREEZE-01, REV-05',
  },
  INSPECT_OBJECT: {
    id: 'INSPECT_OBJECT',
    frozenName: 'Inspection transition (Stage 4)',
    cls: 'A',
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
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
    level: 'METADATA_ONLY',
    owner: 'T-04',
    substrateOwner: null,
    authority: fields('IF_ref', 'MC.depth', ...SPATIAL),
    transactional: 'RH_CHECKPOINT',
    frozenSource: 'Stage 4.1/4.3; Stage 5.2 §2.7 checkpoint',
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
