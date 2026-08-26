import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import { HypothesisServiceRoleApiService } from './hypothesis-service-role-api.service';
import type { CreateHypothesisInput, EvidenceRole, HypothesisRecord, HypothesisStatus } from './hypothesis.types';
const FIELDS = 'id,user_id,statement,type,domain,scope,origin,status,version,supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions,disconfirming_conditions,created_at,updated_at';
// Reads stay on the authenticated owner-scoped path. Creation goes through the
// narrow server-only database command added by migration 0027: `authenticated`
// holds no INSERT on public.hypotheses any more, so a user token is neither
// used nor usable as Hypothesis creation authority here, and status, version,
// Evidence lists, competitors and both timestamps are derived in the database
// rather than submitted. The Evidence attachment and competition commands are
// unchanged and still run on the caller's identity; the lifecycle transition
// moved to the exact-version, audited migration-0036 boundary below and also
// runs on the caller's identity.
@Injectable()
export class HypothesisRepository {
  constructor(
    private readonly dataApi: MemoryDataApiService,
    private readonly serverAuthority: HypothesisServiceRoleApiService,
  ) {}
  async create(id: string, userId: string, input: CreateHypothesisInput): Promise<HypothesisRecord> {
    const rows = await this.serverAuthority.rpc<HypothesisRecord[]>('server_create_hypothesis_v1', {
      p_user_id: userId, p_hypothesis_id: id, p_statement: input.statement, p_type: input.type,
      p_domain: input.domain, p_scope: input.scope, p_origin: input.origin,
      p_assumptions: input.assumptions ?? [], p_disconfirming_conditions: input.disconfirmingConditions ?? [],
    });
    return rows[0];
  }
  async find(token: string, userId: string, id: string): Promise<HypothesisRecord | undefined> {
    const query = new URLSearchParams({ select: FIELDS, id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    return (await this.dataApi.request<HypothesisRecord[]>(token, `hypotheses?${query}`))[0];
  }
  listActive(token: string, userId: string, limit: number): Promise<HypothesisRecord[]> {
    const query = new URLSearchParams({ select: FIELDS, user_id: `eq.${userId}`, status: 'in.(CANDIDATE,ACTIVE,SUPPORTED,MIXED,WEAK,REOPENED)', order: 'updated_at.desc,id.asc', limit: String(limit) });
    return this.dataApi.request<HypothesisRecord[]>(token, `hypotheses?${query}`);
  }
  // Migration 0036: the exact-version, audited lifecycle transition boundary.
  // The legacy last-writer-wins `transition_hypothesis` RPC holds no
  // application EXECUTE authority any more, so this is the only authenticated
  // transition path. The owner is derived from auth.uid() inside the database
  // and the transition source is forced there; the caller supplies only the
  // target, the exact expected version taken from the owned current
  // Hypothesis, and the requested status. A concurrent mutation between that
  // read and this call fails closed with the canonical stale-version error
  // rather than transitioning the newer Hypothesis.
  async transition(token: string, id: string, expectedVersion: number, status: HypothesisStatus): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/transition_hypothesis_v2', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_expected_version: expectedVersion, p_status: status }) }))[0];
  }
  async attachEvidence(token: string, id: string, evidenceId: string, role: EvidenceRole): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/attach_hypothesis_evidence', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_evidence_id: evidenceId, p_role: role }) }))[0];
  }
  async linkCompetitor(token: string, id: string, competitorId: string): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/link_competing_hypotheses', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_competitor_id: competitorId }) }))[0];
  }
}
