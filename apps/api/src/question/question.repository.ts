import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { InformationGapRecord, QuestionCandidateProposal, QuestionCandidateRecord } from './question.types';

@Injectable()
export class QuestionRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}
  async createGap(token: string, value: object): Promise<InformationGapRecord> {
    return (await this.dataApi.request<InformationGapRecord[]>(token, 'rpc/create_information_gap', { method: 'POST', body: JSON.stringify({ p_gap: value }) }))[0];
  }
  async findGap(token: string, userId: string, id: string): Promise<InformationGapRecord | undefined> {
    const q = new URLSearchParams({ select: '*', id: `eq.${id}`, user_id: `eq.${userId}`, limit: '1' });
    return (await this.dataApi.request<InformationGapRecord[]>(token, `information_gaps?${q}`))[0];
  }
  async createCandidate(token: string, id: string, proposal: QuestionCandidateProposal): Promise<QuestionCandidateRecord> {
    return (await this.dataApi.request<QuestionCandidateRecord[]>(token, 'rpc/create_validated_question_candidate', { method: 'POST', body: JSON.stringify({ p_candidate: { id, ...proposal } }) }))[0];
  }
}
