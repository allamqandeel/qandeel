/**
 * T-02 — Canonical Client State + Action Foundation: public surface.
 *
 * Executable kernel: `PAN`, `ZOOM_SEMANTIC`, `COMMIT_MOMENT`, `COMMIT_LIVE_EDGE`, plus the two
 * authoritative mirror ingestions `LIVE_HEAD_ADVANCED` and `LIVE_FOCUS_TRANSITION`. Every
 * other frozen act is metadata only and fails closed until its owning task lands.
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
  SpatialDestinationRef,
  TemporalMode,
  VersionRef,
  WorldAnchorRef,
  WorldOrientationRef,
} from './classes';
export {
  CLASS_A_FIELDS,
  OPAQUE_REF_KINDS,
  SEMANTIC_DEPTHS,
  cameraIntentEquals,
  classAFieldEquals,
  deepFreeze,
  inspectionRefEquals,
  isInspectionRef,
  isCameraIntent,
  isLiveFocus,
  isOpaqueRefOfKind,
  isOpaqueValue,
  isSemanticDepth,
  isSessionPosition,
  liveFocusEquals,
  opaqueRef,
  opaqueRefEquals,
  opaqueValueEquals,
  sessionPosition,
  temporalModeEquals,
} from './classes';

export type {
  AuthoritativeEvent,
  AuthoritativeEventType,
  CatalogClass,
  CatalogEntry,
  CatalogLevel,
  KernelAction,
  KernelActionType,
  MetadataOnlyActionType,
  NonStoreIdentityType,
  PanIntent,
  ProductActId,
  TaskId,
  TransactionalCategory,
  ZoomIntent,
} from './actions';
export {
  ACTION_CATALOG,
  AUTHORITATIVE_EVENT_TYPES,
  FROZEN_TASK_IDS,
  KERNEL_ACTION_TYPES,
  METADATA_ONLY_ACTION_TYPES,
  NON_STORE_IDENTITY_TYPES,
  PRODUCT_ACT_IDS,
  catalogEntry,
} from './actions';

export type { CanonicalStateErrorCode } from './authority';
export {
  CanonicalStateError,
  InvalidInitialState,
  OutOfOrderTransition,
  OwnedByLaterTask,
  PreconditionFailed,
  RetractionRejected,
  UnauthorizedActionClass,
  UnauthorizedClassAWrite,
  UnknownAction,
  UnknownEvent,
  assertAuthorizedClassAWrites,
} from './authority';

export type { ActionTransition, ActionTransitionTable, ClientWritable, EventTransition, EventTransitionTable } from './transitions';
export { KERNEL_ACTION_TRANSITIONS, KERNEL_EVENT_TRANSITIONS } from './transitions';

export type { AppendResult, PhiEff } from './history';
export { appendIfEffective, captureCheckpoint, isEffectiveChange, phiEff, phiEffEquals } from './history';

export type { CommittedNavigationIntent, TemporalOrientation } from './selectors';
export { committedNavigationIntent, effectiveTC, isAddressableMoment, temporalOrientation } from './selectors';

export type { CanonicalStateInit, CanonicalStore, DispatchResult, IngestResult, StoreDependencies } from './store';
export { createCanonicalStore } from './store';

export type { CanonicalStateProviderProps } from './CanonicalStateProvider';
export { CanonicalStateProvider, useCanonicalSelector, useCanonicalStore } from './CanonicalStateProvider';
