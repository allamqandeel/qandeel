/**
 * W1B-01 — the account owner layer: its ONE public surface.
 *
 * It owns the reader's way into an account — Create account and Verify Email beside T-14's Sign in, as
 * one Auth Gateway destination — and the account's first use: the concise Welcome and the Conversation
 * openings. It owns no credential, no Session, no canonical world state and no persistence. The ONE auth
 * authority creates, verifies and establishes; the server decides the Name and the first-use state; the
 * integration owner builds one account controller per runtime generation and retires it with it.
 */

export type { AccountEntryCopy, FirstUseCopy } from './copy';
export { accountEntryCopy, firstUseCopy } from './copy';

export type {
  AccountController,
  AccountControllerOptions,
  AccountPresentationState,
  AccountStatus,
  AccountTransport,
} from './account-controller';
export { ACCOUNT_READ_WAIT_MS, createAccountController } from './account-controller';

export type { LoginIdVerdict } from './entry-rules';
export {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_LIFETIME_MS,
  LOGIN_ID_MAX_LENGTH,
  LOGIN_ID_MIN_LENGTH,
  LOGIN_ID_PATTERN,
  NAME_MAX_LENGTH,
  canonicalName,
  isPlausibleEmail,
  judgeLoginId,
  judgeRejectedCode,
  normalizeEmailCode,
} from './entry-rules';

export type { AccountEntryProps, EntryScreen, SignInEntrySlot } from './entry/AccountEntry';
export { ACCOUNT_ENTRY_TEST_ID, AccountEntry } from './entry/AccountEntry';
export type { CreateAccountFormProps, LoginIdAvailability } from './entry/CreateAccountForm';
export { CREATE_ACCOUNT_TEST_ID } from './entry/CreateAccountForm';
export { VERIFY_EMAIL_TEST_ID } from './entry/VerifyEmailForm';
export type { EntryLocale } from './entry/EntryParts';

export type { WelcomeSurfaceProps } from './first-use/WelcomeSurface';
export { WELCOME_SURFACE_TEST_ID, WelcomeSurface } from './first-use/WelcomeSurface';
export type { FirstUseGateProps } from './first-use/FirstUseGate';
export { FIRST_USE_WAITING_TEST_ID, FirstUseGate } from './first-use/FirstUseGate';
export type { OpeningKind } from './first-use/ConversationOpening';
export { ConversationOpening, openingFor } from './first-use/ConversationOpening';
