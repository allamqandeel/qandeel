import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimMetricDefinition,HimMetricSnapshot } from './him.types';
import type { HimTrendRequest,HimTrendSource,HimTrendSourcePoint } from './him-trend.types';
import type { HimIntelligenceSnapshotRequest,HimSnapshotSourceRow } from './him-intelligence-snapshot.types';
import type { HimCanonicalLatestSourceRow } from './him-contextual-current-intelligence.types';
@Injectable()
export class HimRepository {
  constructor(private readonly dataApi:MemoryDataApiService){}
  async getDefinition(token:string,key:string,version:number):Promise<HimMetricDefinition|undefined>{const rows=await this.dataApi.request<Record<string,unknown>[]>(token,'rpc/get_him_metric_definition',{method:'POST',body:JSON.stringify({p_metric_key:key,p_definition_version:version})});return rows[0]?this.definition(rows[0]):undefined;}
  async listDefinitions(token:string):Promise<HimMetricDefinition[]>{return(await this.dataApi.request<Record<string,unknown>[]>(token,'rpc/list_him_metric_definitions',{method:'POST',body:'{}'})).map(r=>this.definition(r));}
  // QHIM-013: the Foundation-era generic writer createObservation(...), which
  // posted to the legacy generic snapshot RPC, was retired here. Migration 0051
  // turned that database function into a fail-closed no-write tombstone with
  // EXECUTE revoked from PUBLIC, anon, authenticated, and service_role, so this
  // repository holds no generic canonical measurement-write capability and no
  // replacement for it. Everything below is a read: definition reads, the one
  // canonical latest read authority, explicit history/audit reads, and the
  // Trend and Intelligence Snapshot source reads.
  async getLatest(token:string,userId:string,key:string,definitionVersion:number,kind:string,id:string):Promise<HimMetricSnapshot|undefined>{const rows=await this.dataApi.request<HimMetricSnapshot[]>(token,'rpc/read_him_latest_measurement_v1',{method:'POST',body:JSON.stringify({p_user_id:userId,p_metric_key:key,p_definition_version:definitionVersion,p_context_kind:kind,p_context_id:id})});return rows?.[0];}
  // QHIA-003: the SAME single canonical latest read authority, typed with the
  // narrow source-row view that exposes the canonical binding identity the RPC
  // already returns (its SETOF rows carry the 0012 provenance columns). This
  // is typed access, not a second latest read: same RPC, same parameters, same
  // zero-row semantics, no table read, no fallback of any kind.
  async getLatestCurrentIntelligenceSource(token:string,userId:string,key:string,definitionVersion:number,kind:string,id:string):Promise<HimCanonicalLatestSourceRow|undefined>{const rows=await this.dataApi.request<HimCanonicalLatestSourceRow[]>(token,'rpc/read_him_latest_measurement_v1',{method:'POST',body:JSON.stringify({p_user_id:userId,p_metric_key:key,p_definition_version:definitionVersion,p_context_kind:kind,p_context_id:id})});return rows?.[0];}
  // QHIA-003: narrow typed access to the EXISTING ACTIVE-binding resolver
  // installed by migration 0050. No binding table is read directly, no
  // selection logic is duplicated, and no new currentness authority exists.
  async getActiveStructuredBindingId(token:string,key:string,definitionVersion:number,kind:string):Promise<string|null>{const id=await this.dataApi.request<string|null>(token,'rpc/him_active_structured_binding_id',{method:'POST',body:JSON.stringify({p_metric_key:key,p_definition_version:definitionVersion,p_context_kind:kind})});return id??null;}
  listForContext(token:string,userId:string,kind:string,id:string){const q=new URLSearchParams({select:'*',user_id:`eq.${userId}`,context_kind:`eq.${kind}`,context_id:`eq.${id}`,order:'created_at.desc,id.asc',limit:'128'});return this.dataApi.request<HimMetricSnapshot[]>(token,`him_metric_snapshots?${q}`);}
  history(token:string,userId:string,key:string,kind:string,id:string){const q=new URLSearchParams({select:'*',user_id:`eq.${userId}`,metric_key:`eq.${key}`,context_kind:`eq.${kind}`,context_id:`eq.${id}`,order:'snapshot_version.asc',limit:'128'});return this.dataApi.request<HimMetricSnapshot[]>(token,`him_metric_snapshots?${q}`);}
  async readTrendSource(token:string,userId:string,r:HimTrendRequest):Promise<HimTrendSource>{const rows=await this.dataApi.request<Array<{points:HimTrendSourcePoint[];excluded_observation_count:number;active_binding:HimTrendSource['activeBinding']}>>(token,'rpc/read_him_trend_source_v1',{method:'POST',body:JSON.stringify({p_user_id:userId,p_metric_key:r.metricKey,p_definition_version:r.definitionVersion,p_context_kind:r.contextKind,p_context_id:r.contextId,p_window_start:r.windowStart,p_window_end:r.windowEnd})});const row=rows[0];return{points:row?.points??[],excludedObservationCount:Number(row?.excluded_observation_count??0),activeBinding:row?.active_binding??null};}
  readIntelligenceSnapshot(token:string,r:HimIntelligenceSnapshotRequest):Promise<HimSnapshotSourceRow[]>{return this.dataApi.request<HimSnapshotSourceRow[]>(token,'rpc/read_him_intelligence_snapshot_v1',{method:'POST',body:JSON.stringify({p_context_kind:r.contextKind,p_context_id:r.contextId})});}
  private definition(r:Record<string,unknown>):HimMetricDefinition{return{metricKey:r.metric_key as string,canonicalName:r.canonical_name as string,canonicalDefinition:r.canonical_definition as string,canonicalSource:r.canonical_source as string,hifOwner:r.hif_owner as HimMetricDefinition['hifOwner'],semanticMappingStatus:r.semantic_mapping_status as HimMetricDefinition['semanticMappingStatus'],semanticType:r.semantic_type as HimMetricDefinition['semanticType'],definitionVersion:r.definition_version as number,calculationStatus:r.calculation_status as HimMetricDefinition['calculationStatus'],scaleReference:r.scale_reference as string,validContextKinds:r.valid_context_kinds as HimMetricDefinition['validContextKinds'],requiredInputContract:r.required_input_contract as string,confidenceRequirementReference:r.confidence_requirement_reference as string,consumers:r.consumers as string[],sourceMetadata:r.source_metadata as string[],dependencyIds:r.dependency_ids as string[]};}
}

