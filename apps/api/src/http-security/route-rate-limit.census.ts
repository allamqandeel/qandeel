import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { RateLimitClass } from './rate-limit.policy';

/**
 * PROD-SEC-01 (SEC-A) — the ONE route census: every HTTP route QANDEEL serves, as `METHOD /path`, and the rate class
 * that bounds it. The classification lives here, keyed by the route itself, so the frozen controller sources stay
 * untouched, this boundary imports no controller (and so gains no path to any controller's behaviour), and the whole
 * policy reads as the API surface it governs.
 *
 * A route missing from this table is still limited (as `UNCLASSIFIED`, the strict fallback), and the route-census spec
 * fails CI for it: a new route cannot ship without a deliberate class. A stale entry fails the same spec.
 */
export const ROUTE_RATE_LIMIT_CENSUS: Readonly<Record<string, Exclude<RateLimitClass, 'UNCLASSIFIED'>>> = Object.freeze({
  // Probes. Readiness keeps PROD-OPS-01's single-flight check.
  'GET /health': 'HEALTH',
  'GET /health/live': 'HEALTH',
  'GET /health/ready': 'HEALTH',

  // Pre-authentication: no account yet, or not signed in.
  'POST /account/login-id-availability': 'PRE_AUTH_LOOKUP',
  'POST /account/login-id-sign-in': 'PRE_AUTH_CREDENTIAL',
  'POST /account/login-id-verify-email': 'PRE_AUTH_CREDENTIAL',
  'POST /account/login-id-resend-verification': 'PRE_AUTH_MAIL', // sends mail

  // The account's own state (W1B-01 / W3-02).
  'GET /account/first-use': 'AUTHENTICATED',
  'POST /account/first-use/welcome': 'AUTHENTICATED',
  'GET /account/public-id': 'AUTHENTICATED',
  'POST /account/public-id/change': 'SECURITY_SENSITIVE', // the one lifetime change

  // Account & Identity / Security & Sign-in (W3-MEGA-A).
  'GET /account/identity': 'AUTHENTICATED',
  'POST /account/name/change': 'AUTHENTICATED',
  'POST /account/login-id/change': 'SECURITY_SENSITIVE', // password proof
  'POST /account/email/change': 'AUTHENTICATED_MAIL', // sends mail to two addresses
  'POST /account/email/confirm': 'SECURITY_SENSITIVE', // codes
  'POST /account/password/change': 'SECURITY_SENSITIVE',
  'POST /account/sessions/sign-out-others': 'SECURITY_SENSITIVE',

  // Privacy & Data (W3-MEGA-S).
  'GET /account/privacy': 'AUTHENTICATED',
  'POST /account/privacy/export': 'SECURITY_SENSITIVE', // password proof
  'GET /account/privacy/export/download': 'SECURITY_SENSITIVE', // the whole Personal record
  'POST /account/privacy/deletion': 'SECURITY_SENSITIVE', // password proof
  'POST /account/privacy/deletion/cancel': 'SECURITY_SENSITIVE',

  // Conversation and its projections: the foreground poll lives here. AI cost is the database's (PROD-SEC-02, 0131).
  'POST /conversation/sessions': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/turns': 'CONVERSATION',
  'POST /conversation/sessions/:sessionId/turns': 'CONVERSATION',
  'PATCH /conversation/sessions/:sessionId/turns/:turnId/cancel': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/temporal': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/temporal/events': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/temporal/live-focus-events': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/historical-projection': 'CONVERSATION',
  'PUT /conversation/sessions/:sessionId/context-bindings/:contextKind': 'CONVERSATION',
  'DELETE /conversation/sessions/:sessionId/context-bindings/:contextKind': 'CONVERSATION',
  'GET /conversation/sessions/:sessionId/context-bindings': 'CONVERSATION',

  // Understanding (W3-MEGA-U).
  'GET /understanding/items': 'AUTHENTICATED',
  'GET /understanding/items/:ref': 'AUTHENTICATED',
  'POST /understanding/items/:ref/discussion': 'AUTHENTICATED',
  'POST /understanding/items/:ref/disagreement': 'AUTHENTICATED',
  'POST /understanding/items/:ref/disagreement/resolve': 'AUTHENTICATED',
  'DELETE /understanding/items/:ref/discussion': 'AUTHENTICATED',

  // Activity & Notifications (A3-01). The attention read is polled while the app is in the foreground (30 s cadence).
  'GET /activity/items': 'AUTHENTICATED',
  'GET /activity/attention': 'AUTHENTICATED',
  'POST /activity/items/seen': 'AUTHENTICATED',
  'POST /activity/items/:itemId/open': 'AUTHENTICATED',
  'POST /activity/strip': 'AUTHENTICATED',
  'GET /activity/preferences': 'AUTHENTICATED',
  'PUT /activity/preferences': 'AUTHENTICATED',
  'PUT /activity/snooze': 'AUTHENTICATED',
  'PUT /activity/mutes': 'AUTHENTICATED',

  // Native Push device boundary (A3-02). A sync per sign-in / foreground / token rotation; no route sends.
  'PUT /push/device': 'AUTHENTICATED',
  'POST /push/device/detach': 'AUTHENTICATED',
  'POST /push/device/detach-others': 'AUTHENTICATED',
  'POST /push/opened': 'AUTHENTICATED',
});

const segments = (path: unknown): string[] =>
  (Array.isArray(path) ? path : [path]).flatMap((part) => (typeof part === 'string' ? part.split('/') : [])).filter((part) => part !== '');

/** `METHOD /controller/handler` from Nest's own route metadata; `null` for something that is not a routed handler. */
export function routeKeyOf(controller: object, handler: object): string | null {
  const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
  if (method === undefined) return null;
  const path = [...segments(Reflect.getMetadata(PATH_METADATA, controller)), ...segments(Reflect.getMetadata(PATH_METADATA, handler))].join('/');
  return `${RequestMethod[method]} /${path}`;
}

/** Per controller, per handler: one handler function mounted under two controllers is two routes. */
const resolved = new WeakMap<object, WeakMap<object, RateLimitClass>>();

/** The class of the routed handler, resolved once per route. A route the census does not name is `UNCLASSIFIED`. */
export function censusClassOf(controller: object, handler: object): RateLimitClass {
  let routes = resolved.get(controller);
  if (routes === undefined) resolved.set(controller, (routes = new WeakMap()));
  const cached = routes.get(handler);
  if (cached !== undefined) return cached;
  const key = routeKeyOf(controller, handler);
  const routeClass = (key !== null && Object.prototype.hasOwnProperty.call(ROUTE_RATE_LIMIT_CENSUS, key) ? ROUTE_RATE_LIMIT_CENSUS[key] : undefined) ?? 'UNCLASSIFIED';
  routes.set(handler, routeClass);
  return routeClass;
}
