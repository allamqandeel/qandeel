import { AccountSecurityController } from '../account/account-security.controller';
import { AccountController } from '../account/account.controller';
import { LoginIdSignInController } from '../account/login-id-sign-in.controller';
import { PrivacyDataController } from '../account/privacy-data.controller';
import { ConversationContextActivationController } from '../conversation/conversation-context-activation.controller';
import { ConversationHistoricalProjectionController } from '../conversation/conversation-historical-projection.controller';
import { ConversationTemporalController } from '../conversation/conversation-temporal.controller';
import { ConversationController } from '../conversation/conversation.controller';
import { HealthController } from '../health/health.controller';
import { UnderstandingController } from '../understanding/understanding.controller';
import type { RateLimitClass } from './rate-limit.policy';

/**
 * PROD-SEC-01 (SEC-A) — the ONE route census: every HTTP route QANDEEL serves, by controller and handler, and the rate
 * class that bounds it. The classification lives here, not as decorators on the controllers, so the frozen controller
 * sources stay untouched and the whole policy reads in one place.
 *
 * A route missing from this table is still limited (as `UNCLASSIFIED`, the strict fallback), and the route-census spec
 * fails CI for it: a new route cannot ship without a deliberate class. A stale entry fails the same spec.
 */
type Census = ReadonlyMap<abstract new (...args: never[]) => unknown, Readonly<Record<string, Exclude<RateLimitClass, 'UNCLASSIFIED'>>>>;

export const ROUTE_RATE_LIMIT_CENSUS: Census = new Map<abstract new (...args: never[]) => unknown, Readonly<Record<string, Exclude<RateLimitClass, 'UNCLASSIFIED'>>>>([
  // GET /health, /health/live, /health/ready — probes; readiness keeps PROD-OPS-01's single-flight check.
  [HealthController, { getHealth: 'HEALTH', getLive: 'HEALTH', getReady: 'HEALTH' }],

  // Pre-authentication (no account yet, or not signed in).
  [AccountController, {
    checkLoginIdAvailability: 'PRE_AUTH_LOOKUP', // POST /account/login-id-availability
    readFirstUse: 'AUTHENTICATED', // GET /account/first-use
    completeWelcome: 'AUTHENTICATED', // POST /account/first-use/welcome
    readPublicId: 'AUTHENTICATED', // GET /account/public-id
    changePublicId: 'SECURITY_SENSITIVE', // POST /account/public-id/change — the one lifetime change
  }],
  [LoginIdSignInController, {
    signInWithLoginId: 'PRE_AUTH_CREDENTIAL', // POST /account/login-id-sign-in
    verifyLoginIdEmail: 'PRE_AUTH_CREDENTIAL', // POST /account/login-id-verify-email
    resendLoginIdVerification: 'PRE_AUTH_MAIL', // POST /account/login-id-resend-verification — sends mail
  }],

  // Account & Identity / Security & Sign-in (W3-MEGA-A).
  [AccountSecurityController, {
    readIdentity: 'AUTHENTICATED', // GET /account/identity
    changeName: 'AUTHENTICATED', // POST /account/name/change
    changeLoginId: 'SECURITY_SENSITIVE', // POST /account/login-id/change — password proof
    requestEmailChange: 'AUTHENTICATED_MAIL', // POST /account/email/change — sends mail to two addresses
    confirmEmailChange: 'SECURITY_SENSITIVE', // POST /account/email/confirm — codes
    changePassword: 'SECURITY_SENSITIVE', // POST /account/password/change
    signOutOtherDevices: 'SECURITY_SENSITIVE', // POST /account/sessions/sign-out-others
  }],

  // Privacy & Data (W3-MEGA-S).
  [PrivacyDataController, {
    readState: 'AUTHENTICATED', // GET /account/privacy
    requestExport: 'SECURITY_SENSITIVE', // POST /account/privacy/export — password proof
    downloadExport: 'SECURITY_SENSITIVE', // GET /account/privacy/export/download — the whole Personal record
    requestDeletion: 'SECURITY_SENSITIVE', // POST /account/privacy/deletion — password proof
    cancelDeletion: 'SECURITY_SENSITIVE', // POST /account/privacy/deletion/cancel
  }],

  // Conversation and its projections: the foreground poll lives here. AI cost is the database's (PROD-SEC-02).
  [ConversationController, {
    createSession: 'CONVERSATION', // POST /conversation/sessions
    resumeSession: 'CONVERSATION', // GET /conversation/sessions/:sessionId
    listTurns: 'CONVERSATION', // GET /conversation/sessions/:sessionId/turns
    createTurn: 'CONVERSATION', // POST /conversation/sessions/:sessionId/turns — admission bounded by 0131
    cancelTurn: 'CONVERSATION', // PATCH /conversation/sessions/:sessionId/turns/:turnId/cancel
  }],
  [ConversationTemporalController, {
    sessionTemporalState: 'CONVERSATION', // GET .../temporal
    committedEvents: 'CONVERSATION', // GET .../temporal/events
    liveFocusEvents: 'CONVERSATION', // GET .../temporal/live-focus-events
  }],
  [ConversationHistoricalProjectionController, { historicalProjection: 'CONVERSATION' }], // GET .../historical-projection
  [ConversationContextActivationController, {
    activateContext: 'CONVERSATION', // PUT .../context-bindings/:contextKind
    deactivateContext: 'CONVERSATION', // DELETE .../context-bindings/:contextKind
    readActiveContexts: 'CONVERSATION', // GET .../context-bindings
  }],

  // Understanding (W3-MEGA-U).
  [UnderstandingController, {
    list: 'AUTHENTICATED', // GET /understanding/items
    detail: 'AUTHENTICATED', // GET /understanding/items/:ref
    openDiscussion: 'AUTHENTICATED', // POST /understanding/items/:ref/discussion
    disagree: 'AUTHENTICATED', // POST /understanding/items/:ref/disagreement
    closeDiscussion: 'AUTHENTICATED', // DELETE /understanding/items/:ref/discussion
  }],
]);

export function censusClassOf(controller: unknown, handlerName: string): RateLimitClass {
  const routes = ROUTE_RATE_LIMIT_CENSUS.get(controller as abstract new (...args: never[]) => unknown);
  return (routes !== undefined && Object.prototype.hasOwnProperty.call(routes, handlerName) ? routes[handlerName] : undefined) ?? 'UNCLASSIFIED';
}
