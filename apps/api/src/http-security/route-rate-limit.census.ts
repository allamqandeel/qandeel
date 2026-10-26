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
  // S6-07 (CP4): the bundle carries the same whole record; each photo file is one of the reader's own renditions, read
  // exactly as the media route reads it - so it is classed as that route is, and a large export's one request per photo is
  // never refused for its number (the right to export is not bounded by a request count, Q7'').
  'GET /account/privacy/export/download/bundle': 'SECURITY_SENSITIVE',
  'GET /account/privacy/export/download/bundle/files/:fileName': 'AUTHENTICATED',
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

  // Interaction Preferences (IP-IMP-01): owner-only Settings reads and single-field writes, and the optional legacy review.
  'GET /interaction-preferences': 'AUTHENTICATED',
  'PUT /interaction-preferences': 'AUTHENTICATED',
  'GET /interaction-preferences/legacy-review': 'AUTHENTICATED',
  'POST /interaction-preferences/legacy-review': 'AUTHENTICATED',

  // Introductions with QANDEEL - the owner's pre-enrollment preparation (S6-01). Owner-only; nothing enrolls.
  'GET /introductions/availability': 'AUTHENTICATED',
  'GET /introductions/preparation': 'AUTHENTICATED',
  'POST /introductions/preparation/commands': 'AUTHENTICATED',
  'POST /introductions/preparation/discard': 'AUTHENTICATED',
  'POST /introductions/preparation/assistance/grant': 'AUTHENTICATED',
  'POST /introductions/preparation/assistance/revoke': 'AUTHENTICATED',
  // The Introduction's unilateral END (S6-02). An exit right, never throttled like a credential act.
  'POST /introductions/worlds/:worldId/end': 'AUTHENTICATED',
  // A human's own private proposals and the three decisions (S6-04). Owner-only.
  'GET /introductions/proposals': 'AUTHENTICATED',
  'GET /introductions/proposals/:proposalId': 'AUTHENTICATED',
  'POST /introductions/proposals/:proposalId/forward-approval': 'AUTHENTICATED',
  'POST /introductions/proposals/:proposalId/decline': 'AUTHENTICATED',
  'POST /introductions/proposals/:proposalId/withdrawal': 'AUTHENTICATED',
  // S6-05 (migration 0159): the second recipient's acceptance, a decision of the same class as the three above.
  'POST /introductions/proposals/:proposalId/acceptance': 'AUTHENTICATED',
  // S6-05 (CP3, migration 0160): the Introduction World's human conversation. Reading is an ordinary authenticated act;
  // a message is held to the strict class, as the Stage 4 send is (R-8), though it starts no provider generation.
  'GET /introductions/worlds': 'AUTHENTICATED',
  'GET /introductions/worlds/:worldId/messages': 'AUTHENTICATED',
  'GET /introductions/worlds/:worldId/messages/before/:materialId/:establishedAt': 'AUTHENTICATED',
  'POST /introductions/worlds/:worldId/messages': 'SECURITY_SENSITIVE',
  // S6-05 (CP4, migration 0161): the closed history after END - a read, like the CP3 reads.
  'GET /introductions/worlds/:worldId/history': 'AUTHENTICATED',
  'GET /introductions/worlds/:worldId/history/before/:materialId/:establishedAt': 'AUTHENTICATED',
  // S6-06 (CP1, migration 0162): sharing in an Introduction. A share, a photo and a display grant are held to the strict
  // class; reading, the photo bytes, removing and going back to the first name are ordinary acts - a privacy act is
  // never throttled like a credential act.
  'GET /introductions/worlds/:worldId/disclosures': 'AUTHENTICATED',
  'POST /introductions/worlds/:worldId/disclosures/text': 'SECURITY_SENSITIVE',
  'POST /introductions/worlds/:worldId/image/:commandId': 'SECURITY_SENSITIVE',
  'POST /introductions/worlds/:worldId/image-stages': 'SECURITY_SENSITIVE',
  'POST /introductions/worlds/:worldId/image-removal': 'AUTHENTICATED',
  'GET /introductions/worlds/:worldId/media/:handle': 'AUTHENTICATED',
  'POST /introductions/worlds/:worldId/display-name/grant': 'SECURITY_SENSITIVE',
  'POST /introductions/worlds/:worldId/display-name/revoke': 'AUTHENTICATED',
  'GET /introductions/shares': 'AUTHENTICATED',
  // S6-06 (CP1, migration 0163): SUCCESS decisions and the explicit resume, decisions of the same class as S6-04's.
  'GET /introductions/worlds/:worldId/success': 'AUTHENTICATED',
  'POST /introductions/worlds/:worldId/success/approval': 'AUTHENTICATED',
  'POST /introductions/worlds/:worldId/success/withdrawal': 'AUTHENTICATED',
  'GET /introductions/participation': 'AUTHENTICATED',
  'POST /introductions/participation/resume': 'AUTHENTICATED',
  // S6-07 (CP1): the governed enrollment - the read, and the act that carries the human's three consents.
  'GET /introductions/enrollment': 'AUTHENTICATED',
  'POST /introductions/enrollment': 'SECURITY_SENSITIVE',
  // S6-07 (CP3): withdrawing ONE consent is a privacy act - never throttled like a credential act; and the
  // per-Introduction alerts (0167), ordinary acts like the Shared ones.
  'POST /introductions/enrollment/revocation': 'AUTHENTICATED',
  'GET /introductions/alerts': 'AUTHENTICATED',
  'PUT /introductions/worlds/:worldId/alerts': 'AUTHENTICATED',

  // Native Push device boundary (A3-02). A sync per sign-in / foreground / token rotation; no route sends.
  'PUT /push/device': 'AUTHENTICATED',
  'POST /push/device/detach': 'AUTHENTICATED',
  'POST /push/device/detach-others': 'AUTHENTICATED',
  'POST /push/opened': 'AUTHENTICATED',

  // Shared World (S4-01). Submitting a Shared ID and regenerating one are throttled like credential acts: secret
  // credential attempts stay non-enumerating and slow (CW2-08 §32–§33).
  'GET /shared': 'AUTHENTICATED',
  'GET /shared/identity': 'AUTHENTICATED',
  'POST /shared/identity/regenerate': 'SECURITY_SENSITIVE',
  'POST /shared/invitations': 'SECURITY_SENSITIVE',
  'POST /shared/invitations/:invitationId/accept': 'AUTHENTICATED',
  'POST /shared/invitations/:invitationId/decline': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId': 'AUTHENTICATED',
  // S4-02 — the Shared conversation. A message can start one provider generation (QANDEEL's reply), and no database work
  // lease bounds Shared generation (0131 is keyed on Personal turns), so the send is held to the strict class; reading and
  // the owner's own deletion are ordinary authenticated acts.
  // SHARED-VIS-01: the Shared World's Living Analysis geography (migration 0148), reads only.
  'GET /shared/worlds/:worldId/field': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId/field/places/:placeId': 'AUTHENTICATED',
  // S8A-04 CP3-C: the owner's permissions for their own knowledge (migration 0177). Granting consent is classed like the
  // S6-07 consent act; reading and withdrawing are ordinary own acts (a withdrawal is never throttled like a credential act).
  'GET /shared/worlds/:worldId/permissions': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/permissions/requests/:requestId/answer': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/permissions/items/:itemId/allow': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/permissions/items/:itemId/withdraw': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId/materials': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId/materials/before/:materialId/:establishedAt': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/messages': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/materials/:materialId/delete': 'AUTHENTICATED',
  // S4-03 — the Shared lifecycle. A proposal (settings, removal, World end, a history package) creates durable governance
  // state other humans are asked to act on, so it is held to the strict class; reading, leaving (an exit right), approving
  // and the owner's own deletion are ordinary authenticated acts. No new class.
  'GET /shared/worlds/:worldId/manage': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/leave': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/proposals/settings': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/proposals/removal': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/proposals/end': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/proposals/member': 'SECURITY_SENSITIVE',
  'POST /shared/membership-requests/:worldId/:requestId/accept': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/proposals/:proposalId/approve': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId/history-shares/candidates/:memberHandle': 'AUTHENTICATED',
  'GET /shared/worlds/:worldId/history-shares/candidates/:memberHandle/before/:materialId/:establishedAt': 'AUTHENTICATED',
  'POST /shared/worlds/:worldId/history-shares': 'SECURITY_SENSITIVE',
  'POST /shared/worlds/:worldId/history-shares/:packageId/approve': 'AUTHENTICATED',
  'GET /shared/closed/:worldId': 'AUTHENTICATED',
  'GET /shared/closed/:worldId/before/:materialId/:establishedAt': 'AUTHENTICATED',
  'GET /shared/own-material': 'AUTHENTICATED',
  'GET /shared/own-material/history-shares': 'AUTHENTICATED',
  'POST /shared/own-material/history-shares/:worldId/:packageId/approve': 'AUTHENTICATED',
  'GET /shared/own-material/before/:materialId/:establishedAt': 'AUTHENTICATED',
  'POST /shared/own-material/:worldId/:materialId/delete': 'AUTHENTICATED',
  // S4-04 — the per-World Shared alerts (0141): the reader's own mute rows; no content, no fan-out.
  'GET /shared/alerts': 'AUTHENTICATED',
  'PUT /shared/worlds/:worldId/alerts': 'AUTHENTICATED',

  // Public World (S5-01, 0142): the entry verdict and the reader's own display mode (a mode, never label text; no
  // availability oracle, nothing of another reader). Ordinary authenticated own-state acts. No new class.
  'GET /public/entry': 'AUTHENTICATED',
  'GET /public/display': 'AUTHENTICATED',
  'PUT /public/display': 'AUTHENTICATED',
  // Public authoring (S5-02, 0143). Starting a Draft (it provisions the ONE Public Identity) and preparing a package
  // (durable state other humans are asked to approve) take the strict class, as a Shared proposal does; reading, approving,
  // withdrawing one's own approval and committing READY_FOR_REVIEW (not public) are ordinary own acts. No new class.
  'GET /public/authoring': 'AUTHENTICATED',
  'GET /public/authoring/sources': 'AUTHENTICATED',
  'POST /public/authoring/drafts': 'SECURITY_SENSITIVE',
  'POST /public/authoring/drafts/:experienceId/package': 'SECURITY_SENSITIVE',
  'GET /public/authoring/drafts/:experienceId/review': 'AUTHENTICATED',
  'POST /public/authoring/drafts/:experienceId/ready': 'AUTHENTICATED',
  'GET /public/authoring/approvals': 'AUTHENTICATED',
  'POST /public/authoring/approvals/:manifestId/approve': 'AUTHENTICATED',
  'POST /public/authoring/approvals/:manifestId/withdraw': 'AUTHENTICATED',
  // S5-03A — the semantic review. Asking QANDEEL to propose, or to check a correction, can reach the semantic interpreter
  // (a provider call once Stage 8A binds one), so those two take the strict class beside the database's own per-version
  // work bound; reading and accepting are ordinary own acts. No new class.
  'GET /public/authoring/drafts/:experienceId/semantic': 'AUTHENTICATED',
  'POST /public/authoring/drafts/:experienceId/semantic/proposal': 'SECURITY_SENSITIVE',
  'POST /public/authoring/drafts/:experienceId/semantic/accept': 'AUTHENTICATED',
  'POST /public/authoring/drafts/:experienceId/semantic/correction': 'SECURITY_SENSITIVE',
  // S5-03B — the stable Public location and the semantic field. Asking QANDEEL to prepare the place can reach the spatial
  // placer (a provider call once Stage 8A binds one), so it takes the strict class; reading the preparation state and
  // viewing the field, search and panel are ordinary authenticated reads the database bounds itself. No new class.
  'GET /public/authoring/drafts/:experienceId/place': 'AUTHENTICATED',
  'POST /public/authoring/drafts/:experienceId/place': 'SECURITY_SENSITIVE',
  'GET /public/field': 'AUTHENTICATED',
  'GET /public/field/search': 'AUTHENTICATED',
  'GET /public/field/experiences/:experienceId': 'AUTHENTICATED',
  // S5-03C — explicit Public relations. Asking for a relation creates durable state another human is asked to accept, so
  // it takes the strict class, as preparing a package does; reading one's own relations and the four acts on them
  // (accept, decline, cancel, remove) are ordinary own acts the database bounds itself. No new class.
  'GET /public/authoring/relations': 'AUTHENTICATED',
  'POST /public/authoring/relations': 'SECURITY_SENSITIVE',
  'POST /public/authoring/relations/:relationId/accept': 'AUTHENTICATED',
  'POST /public/authoring/relations/:relationId/decline': 'AUTHENTICATED',
  'POST /public/authoring/relations/:relationId/cancel': 'AUTHENTICATED',
  'POST /public/authoring/relations/:relationId/remove': 'AUTHENTICATED',
  // S5-04 — the dependent Public discussion. A post or reply is durable public state other humans read, and an @qandeel
  // post or a request for its one response can reach the Model Router (a provider call), so both take the strict class,
  // as the Shared send does, beside the database's own per-human QANDEEL work bound; reading the discussion is an
  // ordinary authenticated read the database bounds itself (100 per page). No new class.
  'GET /public/field/experiences/:experienceId/discussion': 'AUTHENTICATED',
  'POST /public/field/experiences/:experienceId/discussion': 'SECURITY_SENSITIVE',
  'POST /public/field/experiences/:experienceId/discussion/:postId/qandeel': 'SECURITY_SENSITIVE',
  // S8A-05 CP1 — «Write your topic» (0179). Saving, reading, previewing and deleting one's own private draft, changing a
  // topic's section and discarding a never-published topic are ordinary own acts the database bounds itself (50 drafts,
  // 100 / 5,000 characters). Preparing a draft for publication provisions the ONE Public Identity and creates durable
  // Public state, so it takes the strict class, as starting an S5-02 Draft does (and it is closed until Stage 9). No new
  // class.
  'GET /public/compose/drafts': 'AUTHENTICATED',
  'GET /public/compose/drafts/:draftId': 'AUTHENTICATED',
  'PUT /public/compose/drafts/:draftId': 'AUTHENTICATED',
  'POST /public/compose/drafts/:draftId/delete': 'AUTHENTICATED',
  'GET /public/compose/drafts/:draftId/preview': 'AUTHENTICATED',
  'POST /public/compose/drafts/:draftId/prepare': 'SECURITY_SENSITIVE',
  'POST /public/compose/topics/:experienceId/discard': 'AUTHENTICATED',
  'POST /public/compose/topics/:experienceId/section': 'AUTHENTICATED',
  // S7-01 — the Personal Replay (0169). Preparing a preview derives and seals the canonical historical projection once
  // per selected moment, the heaviest database work a human can ask for here, so it takes the strict class; the draft,
  // its revision, finalizing (a private version, never a distribution), reopening and every read are ordinary own acts
  // the database bounds itself (one range of whole messages, 100 Replays per conversation). No new class.
  'GET /replay/capability': 'AUTHENTICATED',
  'GET /replay/conversations/:sessionId': 'AUTHENTICATED',
  'POST /replay/drafts': 'AUTHENTICATED',
  'POST /replay/:replayId/revisions': 'AUTHENTICATED',
  'POST /replay/:replayId/preview': 'SECURITY_SENSITIVE',
  'POST /replay/:replayId/finalize': 'AUTHENTICATED',
  'POST /replay/:replayId/reopen': 'AUTHENTICATED',
  'GET /replay/:replayId': 'AUTHENTICATED',
  'GET /replay/:replayId/versions/:versionId': 'AUTHENTICATED',
  'GET /replay/:replayId/versions/:versionId/moments': 'AUTHENTICATED',
  'GET /replay/:replayId/versions/:versionId/moments/:ordinal/analysis': 'AUTHENTICATED',
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
