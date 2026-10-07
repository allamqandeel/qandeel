/**
 * S5-02 — the Public authoring Product surface inside «العالم العام» / Public World: the controller, the workspace and
 * the copy (with its one S5-02 Product Copy Gate). S5-03A adds the semantic review stage to the same workspace, with its
 * own copy and its own S5-03A Product Copy Gate. S5-03C adds explicit relations to the same workspace, with its own copy
 * and its own S5-03C Product Copy Gate.
 */
export type { PublicAuthoringCopy } from './copy';
export { PUBLIC_AUTHORING_COPY_GATE, publicAuthoringCopy } from './copy';
export type { PublicSemanticCopy } from './semantic-copy';
export { PUBLIC_SEMANTIC_COPY_GATE, publicSemanticCopy } from './semantic-copy';
export type { PublicRelationCopy } from './relation-copy';
export { PUBLIC_RELATION_COPY_GATE, publicRelationCopy } from './relation-copy';
export type {
  PublicAuthoringController, PublicAuthoringControllerOptions, PublicAuthoringNotice, PublicAuthoringScreen, PublicAuthoringState,
  PublicAuthoringTransport, PublicRelationSearchTransport, PublicRelationTransport, PublicSemanticTransport,
} from './public-authoring-controller';
export {
  PUBLIC_PACKAGE_MAX_SOURCES, createPublicAuthoringController, mintPublicCommandId, personalKey, semanticCorrectionOf, sharedKey,
} from './public-authoring-controller';
export type { PublicAuthoringWorkspaceProps } from './PublicAuthoringWorkspace';
export { PUBLIC_AUTHORING_TEST_ID, PublicAuthoringWorkspace } from './PublicAuthoringWorkspace';
export type { PublicSemanticReviewProps } from './PublicSemanticReview';
export { PublicSemanticReview } from './PublicSemanticReview';
