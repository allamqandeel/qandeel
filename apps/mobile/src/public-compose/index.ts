/**
 * S8A-05 CP1 — «اكتب موضوعك» / Write your topic inside «العالم العام» / Public World: the controller, the workspace and
 * the copy (with its one S8A-05 CP1 Product Copy Gate, open).
 */
export type { PublicComposeCopy, PublicComposeCopyStatus } from './copy';
export { PUBLIC_COMPOSE_COPY_GATE, PUBLIC_COMPOSE_COPY_ROWS, PUBLIC_SECTION_COPY_ROWS, publicComposeCopy } from './copy';
export type {
  PublicComposeController, PublicComposeControllerOptions, PublicComposeDraft, PublicComposeNotice, PublicComposeScreen, PublicComposeState,
  PublicComposeTransport,
} from './public-compose-controller';
export { createPublicComposeController } from './public-compose-controller';
export type { PublicComposeWorkspaceProps } from './PublicComposeWorkspace';
export { PUBLIC_COMPOSE_TEST_ID, PublicComposeWorkspace } from './PublicComposeWorkspace';
