import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { CreateHimMetricObservation, HimMetricDefinition, HimMetricSnapshot } from './him.types';

@Injectable()
export class HimRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}
  async getDefinition(token: string, metricKey: string, definitionVersion: number): Promise<HimMetricDefinition | undefined> {
    const rows = await this.dataApi.request<Record<string, unknown>[]>(token, 'rpc/get_him_metric_definition', { method: 'POST', body: JSON.stringify({ p_metric_key: metricKey, p_definition_version: definitionVersion }) }); return rows[0] ? this.definition(rows[0]) : undefined;
  }
  async listDefinitions(token: string): Promise<HimMetricDefinition[]> { return (await this.dataApi.request<Record<string, unknown>[]>(token, 'rpc/list_him_metric_definitions', { method: 'POST', body: '{}' })).map((row) => this.definition(row)); }
  async createObservation(token: string, value: CreateHimMetricObservation): Promise<HimMetricSnapshot> {
    return (await this.dataApi.request<HimMetricSnapshot[]>(token, 'rpc/create_him_metric_snapshot', { method: 'POST', body: JSON.stringify({ p_observation: value }) }))[0];
  }
  async getLatest(token: string, userId: string, metricKey: string, contextKind: string, contextId: string): Promise<HimMetricSnapshot | undefined> {
    const q = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, metric_key: `eq.${metricKey}`, context_kind: `eq.${contextKind}`, context_id: `eq.${contextId}`, order: 'snapshot_version.desc', limit: '1' });
    return (await this.dataApi.request<HimMetricSnapshot[]>(token, `him_metric_snapshots?${q}`))[0];
  }
  listForContext(token: string, userId: string, contextKind: string, contextId: string): Promise<HimMetricSnapshot[]> {
    const q = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, context_kind: `eq.${contextKind}`, context_id: `eq.${contextId}`, order: 'created_at.desc,id.asc', limit: '128' }); return this.dataApi.request(token, `him_metric_snapshots?${q}`);
  }
  history(token: string, userId: string, metricKey: string, contextKind: string, contextId: string): Promise<HimMetricSnapshot[]> {
    const q = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, metric_key: `eq.${metricKey}`, context_kind: `eq.${contextKind}`, context_id: `eq.${contextId}`, order: 'snapshot_version.asc', limit: '128' }); return this.dataApi.request(token, `him_metric_snapshots?${q}`);
  }
  private definition(row: Record<string, unknown>): HimMetricDefinition { return {
    metricKey: row.metric_key as string, canonicalName: row.canonical_name as string, canonicalDefinition: row.canonical_definition as string,
    canonicalSource: row.canonical_source as string, semanticType: row.semantic_type as HimMetricDefinition['semanticType'], definitionVersion: row.definition_version as number,
    scaleReference: row.scale_reference as string, validContextKinds: row.valid_context_kinds as HimMetricDefinition['validContextKinds'], requiredInputContract: row.required_input_contract as string,
    confidenceRequirementReference: row.confidence_requirement_reference as string, consumers: row.consumers as string[], sourceMetadata: row.source_metadata as string[], dependencyIds: row.dependency_ids as string[],
  }; }
}
