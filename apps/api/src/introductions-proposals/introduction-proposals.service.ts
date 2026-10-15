import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { IntroductionProposalsRepository, type ProposalDecisionKind, type ProposalRow } from './introduction-proposals.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PAGE_DEFAULT = 20;
const PAGE_MAX = 20;

/** The five frozen neutral outcomes (I-07 section 21). Nothing finer exists on the wire. */
export type ProposalStatus = 'AWAITING_YOU' | 'IN_PROGRESS' | 'CLOSED_BY_YOU' | 'NO_LONGER_AVAILABLE' | 'MATCH_CONCLUDED';
const STATUSES: readonly ProposalStatus[] = ['AWAITING_YOU', 'IN_PROGRESS', 'CLOSED_BY_YOU', 'NO_LONGER_AVAILABLE', 'MATCH_CONCLUDED'];

/** What the server says this human may do now. There is no acceptance: that is the Mutual Match commit (S6-05). */
export type ProposalAction = 'APPROVE_FORWARD' | 'DECLINE' | 'WITHDRAW';
const ACTIONS: readonly ProposalAction[] = ['APPROVE_FORWARD', 'DECLINE', 'WITHDRAW'];

/**
 * RECORDED: committed (or the replay of the committed command). CHANGED: the view or the proposal moved; read again.
 * UNAVAILABLE: nothing to decide, for a reason never told. NOT_AVAILABLE_NOW: the launch gate is closed.
 * COMMAND_CONFLICT: this command id already names a different request.
 */
export type ProposalDecisionOutcome = 'RECORDED' | 'CHANGED' | 'UNAVAILABLE' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT';
const OUTCOMES: readonly ProposalDecisionOutcome[] = ['RECORDED', 'CHANGED', 'UNAVAILABLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT'];

/** One private proposal as its recipient may see it: no name, conclusion, field, role, state, date or counterparty. */
export interface PrivateProposal {
  readonly proposalId: string;
  readonly viewId: string;
  readonly status: ProposalStatus;
  readonly actions: readonly ProposalAction[];
}

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };

/** A row is used only if every field is exactly what migration 0158 answers; anything else fails closed. */
function decode(row: ProposalRow | undefined): PrivateProposal {
  const actions = row?.available_actions;
  if (!row || typeof row.recipient_view_id !== 'string' || !UUID.test(row.recipient_view_id)
      || typeof row.matching_proposal_id !== 'string' || !UUID.test(row.matching_proposal_id)
      || !STATUSES.includes(row.neutral_outcome as ProposalStatus)
      || !Array.isArray(actions) || actions.some((a) => !ACTIONS.includes(a as ProposalAction)) || new Set(actions).size !== actions.length
      || Object.keys(row).length !== 4) {
    return unavailable();
  }
  return Object.freeze({
    proposalId: row.matching_proposal_id.toLowerCase(), viewId: row.recipient_view_id.toLowerCase(),
    status: row.neutral_outcome as ProposalStatus, actions: Object.freeze([...actions] as ProposalAction[]),
  });
}

/**
 * S6-04 - a human's own private Introduction proposals (D2-D10): the bounded listing, one proposal, and the three
 * decisions. Every decision carries one command id and the exact view the human saw, and nothing else; the database
 * decides it under its own lock and answers one fixed word. No retry here: a repeated request is the same command,
 * answered from its committed row. Nothing is logged.
 */
@Injectable()
export class IntroductionProposalsService {
  constructor(private readonly repository: IntroductionProposalsRepository) {}

  async list(token: string, after: unknown, limit: unknown): Promise<{ readonly proposals: readonly PrivateProposal[]; readonly next: string | null }> {
    if (after !== undefined && (typeof after !== 'string' || !UUID.test(after))) invalid();
    if (limit !== undefined && (typeof limit !== 'string' || !/^[1-9][0-9]?$/u.test(limit) || Number(limit) > PAGE_MAX)) invalid();
    const page = limit === undefined ? PAGE_DEFAULT : Number(limit);
    const rows = await this.guard(() => this.repository.list(token, after === undefined ? null : (after as string).toLowerCase(), page));
    if (!Array.isArray(rows) || rows.length > page) return unavailable();
    const proposals = rows.map(decode);
    return { proposals, next: proposals.length === page ? proposals[proposals.length - 1].proposalId : null };
  }

  async get(token: string, proposalId: string): Promise<{ readonly proposal: PrivateProposal | null }> {
    // Not an identifier, not theirs, never offered to them, or nonexistent: the same answer.
    if (!UUID.test(proposalId)) return { proposal: null };
    const rows = await this.guard(() => this.repository.get(token, proposalId.toLowerCase()));
    if (!Array.isArray(rows) || rows.length > 1) return unavailable();
    return { proposal: rows.length === 0 ? null : decode(rows[0]) };
  }

  async decide(token: string, kind: ProposalDecisionKind, proposalId: string, body: unknown)
    : Promise<{ readonly outcome: ProposalDecisionOutcome; readonly proposal: PrivateProposal | null }> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).some((key) => key !== 'commandId' && key !== 'viewId')
        || typeof value.commandId !== 'string' || !UUID.test(value.commandId)
        || typeof value.viewId !== 'string' || !UUID.test(value.viewId)) invalid();
    if (!UUID.test(proposalId)) return { outcome: 'UNAVAILABLE', proposal: null };
    const rows = await this.guard(() => this.repository.decide(token, kind,
      (value.commandId as string).toLowerCase(), proposalId.toLowerCase(), (value.viewId as string).toLowerCase()));
    const outcome = OUTCOMES.find((candidate) => Array.isArray(rows) && rows.length === 1 && candidate === rows[0]?.outcome);
    if (outcome === undefined) return unavailable();
    // The answer carries what the human may see NOW, so a client never acts on the view it already had. If that read
    // fails, the decision's own answer still stands (proposal: null) and the client reads the list again.
    const proposal = await this.get(token, proposalId).then((answer) => answer.proposal, () => null);
    return { outcome, proposal };
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      // Only a request the database refuses as malformed (22023) is the client's own contradiction. Every other refusal
      // is unavailable, with nothing of the database's answer passed on.
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }
}
