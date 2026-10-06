/**
 * S5-02 — the Public authoring Product surface inside «العالم العام» / Public World: the controller, the workspace and
 * the copy (with its one S5-02 Product Copy Gate).
 */
export type { PublicAuthoringCopy } from './copy';
export { PUBLIC_AUTHORING_COPY_GATE, publicAuthoringCopy } from './copy';
export type {
  PublicAuthoringController, PublicAuthoringControllerOptions, PublicAuthoringNotice, PublicAuthoringScreen, PublicAuthoringState,
  PublicAuthoringTransport,
} from './public-authoring-controller';
export { PUBLIC_PACKAGE_MAX_SOURCES, createPublicAuthoringController, mintPublicCommandId, personalKey, sharedKey } from './public-authoring-controller';
export type { PublicAuthoringWorkspaceProps } from './PublicAuthoringWorkspace';
export { PUBLIC_AUTHORING_TEST_ID, PublicAuthoringWorkspace } from './PublicAuthoringWorkspace';
