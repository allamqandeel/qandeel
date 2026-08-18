import { BadRequestException, Injectable } from '@nestjs/common';
import { HIM_CONTEXT_KINDS, HIM_SEMANTIC_TYPES, MAX_HIM_DEPENDENCIES, type HimMetricDefinition } from './him.types';

const KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const bounded = (value: unknown, max: number, field: string): string => {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > max) throw new BadRequestException(`Invalid ${field}.`);
  return value;
};
const unique = (values: string[], max: number, field: string): void => {
  if (!Array.isArray(values) || values.length > max || new Set(values).size !== values.length) throw new BadRequestException(`Invalid ${field}.`);
  values.forEach((value) => bounded(value, 128, field));
};

@Injectable()
export class HimDefinitionRegistry {
  private readonly definitions = new Map<string, HimMetricDefinition>();

  register(definition: HimMetricDefinition): void {
    this.validate(definition);
    const identity = `${definition.metricKey}@${definition.definitionVersion}`;
    if (this.definitions.has(identity)) throw new BadRequestException('Duplicate HIM metric identity/version.');
    this.definitions.set(identity, Object.freeze({ ...definition, validContextKinds: [...definition.validContextKinds], consumers: [...definition.consumers], sourceMetadata: [...definition.sourceMetadata], dependencyIds: [...definition.dependencyIds] }));
    try { this.validateDependencies(); } catch (error) { this.definitions.delete(identity); throw error; }
  }

  get(metricKey: string, definitionVersion: number): HimMetricDefinition | undefined { return this.definitions.get(`${metricKey}@${definitionVersion}`); }
  list(): HimMetricDefinition[] { return [...this.definitions.values()]; }

  private validate(definition: HimMetricDefinition): void {
    if (!KEY.test(bounded(definition.metricKey, 128, 'metricKey'))) throw new BadRequestException('Invalid metricKey.');
    bounded(definition.canonicalName, 160, 'canonicalName'); bounded(definition.canonicalDefinition, 2000, 'canonicalDefinition');
    bounded(definition.canonicalSource, 256, 'canonicalSource'); bounded(definition.scaleReference, 256, 'scaleReference');
    bounded(definition.requiredInputContract, 1000, 'requiredInputContract'); bounded(definition.confidenceRequirementReference, 256, 'confidenceRequirementReference');
    if (!Number.isSafeInteger(definition.definitionVersion) || definition.definitionVersion < 1) throw new BadRequestException('Invalid definitionVersion.');
    if (!HIM_SEMANTIC_TYPES.includes(definition.semanticType)) throw new BadRequestException('Unsupported semanticType.');
    if (!Array.isArray(definition.validContextKinds) || definition.validContextKinds.length === 0 || new Set(definition.validContextKinds).size !== definition.validContextKinds.length || definition.validContextKinds.some((kind) => !HIM_CONTEXT_KINDS.includes(kind))) throw new BadRequestException('Invalid validContextKinds.');
    unique(definition.consumers, 16, 'consumers'); unique(definition.sourceMetadata, 16, 'sourceMetadata'); unique(definition.dependencyIds, MAX_HIM_DEPENDENCIES, 'dependencyIds');
    if (definition.dependencyIds.includes(definition.metricKey)) throw new BadRequestException('A HIM metric cannot depend on itself.');
  }

  private validateDependencies(): void {
    const latest = new Map<string, HimMetricDefinition>();
    for (const definition of this.definitions.values()) if (!latest.has(definition.metricKey) || latest.get(definition.metricKey)!.definitionVersion < definition.definitionVersion) latest.set(definition.metricKey, definition);
    for (const definition of latest.values()) for (const dependency of definition.dependencyIds) if (!latest.has(dependency)) throw new BadRequestException(`Unresolved HIM dependency: ${dependency}.`);
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (key: string): void => { if (visiting.has(key)) throw new BadRequestException('Cyclic HIM dependency.'); if (visited.has(key)) return; visiting.add(key); latest.get(key)?.dependencyIds.forEach(visit); visiting.delete(key); visited.add(key); };
    latest.forEach((_, key) => visit(key));
  }
}
