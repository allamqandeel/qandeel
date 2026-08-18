import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HIM_CONTEXT_KINDS, HIM_VALIDITY_STATUSES, HIM_VALUE_STATES, MAX_HIM_CONTEXT_ID_LENGTH, MAX_HIM_EVIDENCE_PER_ROLE, MAX_HIM_SOURCE_ENGINES, type CreateHimMetricObservation, type HimContextKind } from './him.types';
import { HimRepository } from './him.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const boundedUnique = (values: string[], max: number, field: string, memoryRefs = false): void => {
  if (!Array.isArray(values) || values.length > max || new Set(values).size !== values.length || values.some((value) => typeof value !== 'string' || value.length === 0 || value.length > 128 || (memoryRefs && !/^memory:[0-9a-f-]{36}$/i.test(value)))) throw new BadRequestException(`Invalid ${field}.`);
};

@Injectable()
export class HimService {
  constructor(private readonly repository: HimRepository) {}
  async observe(userId: string, token: string, observation: Omit<CreateHimMetricObservation, 'id'>) {
    this.validateObservation(observation);
    const definition = await this.repository.getDefinition(token, observation.metricKey, observation.definitionVersion);
    if (!definition) throw new NotFoundException('HIM metric definition not found.');
    if (!definition.validContextKinds.includes(observation.contextKind)) throw new BadRequestException('Metric definition does not support this exact context kind.');
    return this.repository.createObservation(token, {
      id: randomUUID(), metricKey: observation.metricKey, definitionVersion: observation.definitionVersion,
      valueState: observation.valueState, ...(observation.valueState === 'ASSESSED' ? { numericValue: observation.numericValue } : {}),
      supportingEvidenceIds: observation.supportingEvidenceIds ?? [], contradictingEvidenceIds: observation.contradictingEvidenceIds ?? [],
      sourceEngines: observation.sourceEngines, contextKind: observation.contextKind, contextId: observation.contextId, scope: observation.scope,
      ...(observation.temporalWindowStart ? { temporalWindowStart: observation.temporalWindowStart, temporalWindowEnd: observation.temporalWindowEnd } : {}),
      validityStatus: observation.validityStatus, updateReason: observation.updateReason, updateProvenanceIds: observation.updateProvenanceIds ?? [],
    });
  }
  getLatest(userId: string, token: string, metricKey: string, contextKind: HimContextKind, contextId: string) { this.validateContext(contextKind, contextId); return this.repository.getLatest(token, userId, metricKey, contextKind, contextId); }
  listForContext(userId: string, token: string, contextKind: HimContextKind, contextId: string) { this.validateContext(contextKind, contextId); return this.repository.listForContext(token, userId, contextKind, contextId); }
  history(userId: string, token: string, metricKey: string, contextKind: HimContextKind, contextId: string) { this.validateContext(contextKind, contextId); return this.repository.history(token, userId, metricKey, contextKind, contextId); }
  private validateObservation(value: Omit<CreateHimMetricObservation, 'id'>): void {
    if (!HIM_VALUE_STATES.includes(value.valueState) || !HIM_VALIDITY_STATUSES.includes(value.validityStatus)) throw new BadRequestException('Invalid HIM state.');
    if (value.valueState === 'UNASSESSED' && value.numericValue !== undefined) throw new BadRequestException('Unassessed metrics cannot carry a value.');
    if (value.valueState === 'ASSESSED' && (typeof value.numericValue !== 'number' || !Number.isFinite(value.numericValue))) throw new BadRequestException('Assessed metrics require a finite numeric value.');
    if (!Number.isSafeInteger(value.definitionVersion) || value.definitionVersion < 1 || typeof value.metricKey !== 'string' || value.metricKey.length > 128) throw new BadRequestException('Invalid definition identity.');
    this.validateContext(value.contextKind, value.contextId);
    if (typeof value.scope !== 'string' || value.scope.trim() !== value.scope || value.scope.length === 0 || value.scope.length > 256 || typeof value.updateReason !== 'string' || value.updateReason.trim() !== value.updateReason || value.updateReason.length === 0 || value.updateReason.length > 500) throw new BadRequestException('Invalid scope or update reason.');
    boundedUnique(value.supportingEvidenceIds ?? [], MAX_HIM_EVIDENCE_PER_ROLE, 'supportingEvidenceIds', true); boundedUnique(value.contradictingEvidenceIds ?? [], MAX_HIM_EVIDENCE_PER_ROLE, 'contradictingEvidenceIds', true); boundedUnique(value.updateProvenanceIds ?? [], MAX_HIM_EVIDENCE_PER_ROLE, 'updateProvenanceIds', true); boundedUnique(value.sourceEngines, MAX_HIM_SOURCE_ENGINES, 'sourceEngines');
    if (value.sourceEngines.length === 0 || (value.supportingEvidenceIds ?? []).some((id) => (value.contradictingEvidenceIds ?? []).includes(id))) throw new BadRequestException('Invalid HIM provenance.');
    if ((value.temporalWindowStart === undefined) !== (value.temporalWindowEnd === undefined) || (value.temporalWindowStart && (!Number.isFinite(Date.parse(value.temporalWindowStart)) || !Number.isFinite(Date.parse(value.temporalWindowEnd!)) || Date.parse(value.temporalWindowStart) > Date.parse(value.temporalWindowEnd!)))) throw new BadRequestException('Invalid temporal window.');
  }
  private validateContext(kind: HimContextKind, id: string): void {
    if (!HIM_CONTEXT_KINDS.includes(kind) || typeof id !== 'string' || id.trim() !== id || id.length === 0 || id.length > MAX_HIM_CONTEXT_ID_LENGTH) throw new BadRequestException('Invalid exact HIM context.');
    if (kind === 'GLOBAL' ? id !== 'GLOBAL' : id === 'GLOBAL' || (!UUID.test(id) && kind !== 'SITUATION')) throw new BadRequestException('Context identity does not match its kind.');
  }
}
