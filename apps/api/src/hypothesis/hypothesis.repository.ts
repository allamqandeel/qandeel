import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { CreateHypothesisInput, EvidenceRole, HypothesisRecord, HypothesisStatus } from './hypothesis.types';
const FIELDS = 'id,user_id,statement,type,domain,scope,origin,status,version,supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions,disconfirming_conditions,created_at,updated_at';
@Injectable()
export class HypothesisRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}
  async create(token: string, id: string, userId: string, input: CreateHypothesisInput): Promise<HypothesisRecord> {
    const rows = await this.dataApi.request<HypothesisRecord[]>(token, 'hypotheses', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id, user_id: userId, statement: input.statement, type: input.type, domain: input.domain, scope: input.scope, origin: input.origin, status: 'CANDIDATE', assumptions: input.assumptions ?? [], disconfirming_conditions: input.disconfirmingConditions ?? [] }) });
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
  async transition(token: string, id: string, status: HypothesisStatus): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/transition_hypothesis', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_status: status }) }))[0];
  }
  async attachEvidence(token: string, id: string, evidenceId: string, role: EvidenceRole): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/attach_hypothesis_evidence', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_evidence_id: evidenceId, p_role: role }) }))[0];
  }
  async linkCompetitor(token: string, id: string, competitorId: string): Promise<HypothesisRecord | undefined> {
    return (await this.dataApi.request<HypothesisRecord[]>(token, 'rpc/link_competing_hypotheses', { method: 'POST', body: JSON.stringify({ p_hypothesis_id: id, p_competitor_id: competitorId }) }))[0];
  }
}
