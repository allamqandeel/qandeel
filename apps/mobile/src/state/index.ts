/**
 * T-02 — Canonical Client State + Action Foundation: public surface.
 *
 * Executable kernel: `PAN`, `ZOOM_SEMANTIC`, `COMMIT_MOMENT`, `COMMIT_LIVE_EDGE`, plus the two
 * authoritative mirror ingestions `LIVE_HEAD_ADVANCED` and `LIVE_FOCUS_TRANSITION`. T-04 added
 * the three promoted Map acts `INSPECT_OBJECT`, `SWITCH_CONTEXT` and `DIRECT_JUMP`; T-06 added
 * the two promoted temporal acts `COMMIT_MOMENT_AND_LOCATE` and `CHOOSE_LOCUS`. Every other
 * frozen act — the six T-07 return identities — is metadata only and fails closed until T-07
 * lands, and the Class C / D identities never reach the store at all.
 */
export type {
  CameraIntent,
  CanonicalIdentityRef,
  CanonicalState,
  ClassAField,
  ContextualAppearanceRef,
  InspectionRef,
  LineageRef,
  LiveFocus,
  LiveFocusMirror,
  LiveHead,
  LiveTruth,
  OpaquePrimitive,
  OpaqueRef,
  OpaqueRefKind,
  OpaqueValue,
  RhCheckpoint,
  RhEntry,
  ScaleIntentRef,
  SemanticDepth,
  SessionPosition,
  ShapeIssue,
  SpatialDestinationRef,
  TemporalMode,
  VersionRef,
  WorldAnchorRef,
  WorldOrientationRef,
} from './classes';
export {
  CANONICAL_STATE_KEYS,
  CLASS_A_FIELDS,
  OPAQUE_REF_KINDS,
  SEMANTIC_DEPTHS,
  cameraIntentEquals,
  cameraIntentShapeIssue,
  canonicalStateShapeIssue,
  classAFieldEquals,
  deepFreeze,
  exactShapeIssue,
  inspectionRefEquals,
  inspectionRefShapeIssue,
  isCameraIntent,
  isInspectionRef,
  isLiveFocus,
  isOpaqueRefOfKind,
  isOpaqueValue,
  isPlainRecord,
  isSemanticDepth,
  isSessionPosition,
  liveFocusEquals,
  liveFocusShapeIssue,
  liveTruthShapeIssue,
  opaqueRef,
  opaqueRefEquals,
  opaqueRefShapeIssue,
  opaqueValueEquals,
  rhCheckpointShapeIssue,
  rhEntryShapeIssue,
  sessionPosition,
  temporalModeEquals,
  temporalModeShapeIssue,
} from './classes';

export type {
  AuthoritativeEvent,
  AuthoritativeEventType,
  CatalogClass,
  CatalogEntry,
  CatalogLevel,
  DirectJumpLanding,
  KernelAction,
  KernelActionType,
  LocateLanding,
  MapAction,
  MapActionType,
  MetadataOnlyActionType,
  NonStoreIdentityType,
  PanIntent,
  ProductActId,
  RhActionId,
  StoreAction,
  StoreActionType,
  TaskId,
  TemporalAction,
  TemporalActionType,
  TransactionalCategory,
  ZoomIntent,
} from './actions';
export {
  ACTION_CATALOG,
  AUTHORITATIVE_EVENT_TYPES,
  EXECUTABLE_CATALOG_LEVELS,
  FROZEN_TASK_IDS,
  KERNEL_ACTION_TYPES,
  MAP_ACTION_TYPES,
  METADATA_ONLY_ACTION_TYPES,
  NON_STORE_IDENTITY_TYPES,
  PRODUCT_ACT_IDS,
  RH_ACTION_IDS,
  TEMPORAL_ACTION_TYPES,
  catalogEntry,
  isRhActionId,
} from './actions';

export type { CanonicalStateErrorCode } from './authority';
export {
  CanonicalStateError,
  ImmutableContextViolation,
  InvalidCanonicalShape,
  InvalidInitialState,
  OutOfOrderTransition,
  OwnedByLaterTask,
  PreconditionFailed,
  RetractionRejected,
  UnauthorizedActionClass,
  UnauthorizedClassAWrite,
  UnauthorizedMapAction,
  UnauthorizedTemporalAction,
  UnknownAction,
  UnknownEvent,
  assertAuthorizedClassAWrites,
} from './authority';

export type {
  ActionTransition,
  ActionTransitionTable,
  ClientWritable,
  EventTransition,
  EventTransitionTable,
  KernelActionTransitionTable,
  MapActionTransitionTable,
  TemporalActionTransitionTable,
} from './transitions';
export {
  KERNEL_ACTION_TRANSITIONS,
  KERNEL_EVENT_TRANSITIONS,
  MAP_ACTION_TRANSITIONS,
  STORE_ACTION_TRANSITIONS,
  TEMPORAL_ACTION_TRANSITIONS,
} from './transitions';

export type { AppendResult, PhiEff } from './history';
export { appendIfEffective, captureCheckpoint, isEffectiveChange, phiEff, phiEffEquals } from './history';

export type { CommittedNavigationIntent, TemporalOrientation } from './selectors';
export { committedNavigationIntent, effectiveTC, isAddressableMoment, temporalOrientation } from './selectors';

export type {
  CanonicalStateInit,
  CanonicalStore,
  DispatchResult,
  IngestResult,
  MapActionAuthority,
  StoreDependencies,
  TemporalActionAuthority,
} from './store';
export { createCanonicalStore } from './store';

export type { CanonicalStateProviderProps } from './CanonicalStateProvider';
export { CanonicalStateProvider, useCanonicalSelector, useCanonicalStore } from './CanonicalStateProvider';
