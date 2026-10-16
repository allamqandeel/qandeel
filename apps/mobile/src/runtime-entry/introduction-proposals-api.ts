/**
 * S6-04 — the client for a human's own private Introduction proposals («مقترحات التعارف»).
 *
 *   GET  /introductions/proposals?after=&limit=                     — { proposals, next }
 *   POST /introductions/proposals/:proposalId/forward-approval      — { commandId, viewId } → { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/decline               — { commandId, viewId } → { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/withdrawal            — { commandId, viewId } → { outcome, proposal }
 *   POST /introductions/proposals/:proposalId/acceptance            — { commandId, viewId } → { outcome, worldId, proposal }  (S6-05)
 *
 * A transport and nothing else: no credential of its own (the AC-01 request-time seam its caller hands it), no user id,
 * no role, no state, no retry, no persistence. It decodes STRICTLY: a proposal is an opaque proposal and view identity,
 * one of the five neutral statuses and the decisions the server offers now — any other field (a name, a conclusion, a
 * date) makes the whole answer unusable, so nothing the Product does not allow can reach the page.
 *
 * S6-05 (CP5): `ACCEPT` is a decision the server may offer the second recipient, and only when the CW2-08 seam clears
 * (in production it never does yet, so it is never offered). The acceptance answers one fixed word; only `MATCHED` names
 * a World, and it must.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type ProposalStatus = 'AWAITING_YOU' | 'IN_PROGRESS' | 'CLOSED_BY_YOU' | 'NO_LONGER_AVAILABLE' | 'MATCH_CONCLUDED';
export type ProposalAction = 'APPROVE_FORWARD' | 'DECLINE' | 'WITHDRAW' | 'ACCEPT';
export type ProposalDecisionKind = 'forward-approval' | 'decline' | 'withdrawal';
export type ProposalDecisionOutcome = 'RECORDED' | 'CHANGED' | 'UNAVAILABLE' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT';
/** S6-05: the acceptance's one word. MATCHED is the committed Mutual Match (or the replay of that commit). */
export type ProposalAcceptanceOutcome = 'MATCHED' | 'CHANGED' | 'UNAVAILABLE' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT';

export interface PrivateProposal {
  readonly proposalId: string;
  readonly viewId: string;
  readonly status: ProposalStatus;
  readonly actions: readonly ProposalAction[];
}

/** OFFLINE: no answer arrived at all. UNAVAILABLE: an answer arrived and it was not a usable page. */
export type ProposalsRead =
  | { readonly kind: 'READ'; readonly proposals: readonly PrivateProposal[]; readonly next: string | null }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'OFFLINE' };
/** FAILED: the outcome is not known; asking again with the SAME command id is safe. INVALID: refused as a request. */
export type ProposalDecision =
  | { readonly kind: 'ANSWERED'; readonly outcome: ProposalDecisionOutcome; readonly proposal: PrivateProposal | null }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'FAILED' };
/** S6-05: as a decision; MATCHED alone carries the World the accepting human now belongs to. */
export type ProposalAcceptance =
  | { readonly kind: 'ANSWERED'; readonly outcome: ProposalAcceptanceOutcome; readonly worldId: string | null; readonly proposal: PrivateProposal | null }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'FAILED' };

export interface IntroductionProposalsApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const STATUSES: readonly string[] = ['AWAITING_YOU', 'IN_PROGRESS', 'CLOSED_BY_YOU', 'NO_LONGER_AVAILABLE', 'MATCH_CONCLUDED'];
const ACTIONS: readonly string[] = ['APPROVE_FORWARD', 'DECLINE', 'WITHDRAW', 'ACCEPT'];
const OUTCOMES: readonly string[] = ['RECORDED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'];
const ACCEPTANCE_OUTCOMES: readonly string[] = ['MATCHED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One proposal, or `null` when anything is doubtful — an extra field included. */
export function decodePrivateProposal(value: unknown): PrivateProposal | null {
  if (!isRecord(value) || Object.keys(value).length !== 4) return null;
  const { proposalId, viewId, status, actions } = value;
  if (typeof proposalId !== 'string' || !UUID.test(proposalId) || typeof viewId !== 'string' || !UUID.test(viewId)) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (!Array.isArray(actions) || !actions.every((a) => typeof a === 'string' && ACTIONS.includes(a)) || new Set(actions).size !== actions.length) return null;
  return Object.freeze({ proposalId, viewId, status: status as ProposalStatus, actions: Object.freeze([...actions] as ProposalAction[]) });
}

/** The signed-in private proposals client. Built on the AC-01 seam bound to one identity. */
export class IntroductionProposalsApiClient {
  constructor(private readonly config: IntroductionProposalsApiConfig) {}

  async list(after: string | null): Promise<ProposalsRead> {
    const query = after === null ? '' : `?after=${encodeURIComponent(after)}`;
    const { status, body } = await this.request('GET', `/introductions/proposals${query}`);
    if (status === 0) return { kind: 'OFFLINE' };
    if (!isRecord(body) || !Array.isArray(body.proposals) || !(body.next === null || (typeof body.next === 'string' && UUID.test(body.next)))) {
      return { kind: 'UNAVAILABLE' };
    }
    const proposals = body.proposals.map(decodePrivateProposal);
    if (proposals.some((p) => p === null)) return { kind: 'UNAVAILABLE' };
    return { kind: 'READ', proposals: proposals as PrivateProposal[], next: body.next as string | null };
  }

  async decide(kind: ProposalDecisionKind, proposalId: string, commandId: string, viewId: string): Promise<ProposalDecision> {
    const { status, body } = await this.request('POST', `/introductions/proposals/${encodeURIComponent(proposalId)}/${kind}`, { commandId, viewId });
    if (status === 400) return { kind: 'INVALID' };
    if (!isRecord(body) || typeof body.outcome !== 'string' || !OUTCOMES.includes(body.outcome)) return { kind: 'FAILED' };
    const proposal = body.proposal === null ? null : decodePrivateProposal(body.proposal);
    if (body.proposal !== null && proposal === null) return { kind: 'FAILED' };
    return { kind: 'ANSWERED', outcome: body.outcome as ProposalDecisionOutcome, proposal };
  }

  /** S6-05: the second recipient's acceptance, bound to the exact view they were shown. */
  async accept(proposalId: string, commandId: string, viewId: string): Promise<ProposalAcceptance> {
    const { status, body } = await this.request('POST', `/introductions/proposals/${encodeURIComponent(proposalId)}/acceptance`, { commandId, viewId });
    if (status === 400) return { kind: 'INVALID' };
    if (!isRecord(body) || Object.keys(body).length !== 3 || typeof body.outcome !== 'string' || !ACCEPTANCE_OUTCOMES.includes(body.outcome)) return { kind: 'FAILED' };
    const { outcome, worldId } = body;
    if (outcome === 'MATCHED' ? typeof worldId !== 'string' || !UUID.test(worldId) : worldId !== null) return { kind: 'FAILED' };
    const proposal = body.proposal === null ? null : decodePrivateProposal(body.proposal);
    if (body.proposal !== null && proposal === null) return { kind: 'FAILED' };
    return { kind: 'ANSWERED', outcome: outcome as ProposalAcceptanceOutcome, worldId: worldId === null ? null : (worldId as string).toLowerCase(), proposal };
  }

  /** The status and decoded JSON of an answer; `body` is `undefined` for anything but a 2xx. Never thrown. */
  private async request(method: string, path: string, payload?: unknown): Promise<{ readonly status: number; readonly body: unknown }> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return { status: response.status, body: undefined };
      return { status: response.status, body: await response.json() };
    } catch {
      return { status: 0, body: undefined };
    }
  }
}
