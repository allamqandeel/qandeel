import { BadRequestException } from '@nestjs/common';
import { HimDefinitionRegistry } from './him-definition.registry';
import { HIM_SEMANTIC_TYPES, type HimMetricDefinition } from './him.types';

const definition = (metricKey: string, dependencyIds: string[] = [], definitionVersion = 1): HimMetricDefinition => ({
  metricKey, canonicalName: metricKey, canonicalDefinition: 'Canonical test-only definition', canonicalSource: 'test-source', semanticType: 'STATE', definitionVersion,
  scaleReference: 'canonical-scale-reference', validContextKinds: ['DECISION'], requiredInputContract: 'canonical-input-reference',
  confidenceRequirementReference: 'future-confidence-contract', consumers: [], sourceMetadata: ['test-only'], dependencyIds,
});

describe('HimDefinitionRegistry', () => {
  it('bounds semantic types and starts with no production definitions', () => { expect(HIM_SEMANTIC_TYPES).toEqual(['STATE','TRAIT','CAPABILITY','READINESS','ALIGNMENT','UNCERTAINTY','PROGRESS','LOAD']); expect(new HimDefinitionRegistry().list()).toEqual([]); });
  it.each([{ ...definition('valid'), metricKey: 'UPPER' }, { ...definition('valid'), semanticType: 'PERSONALITY' }, { ...definition('valid'), validContextKinds: ['ANYWHERE'] }, { ...definition('valid'), canonicalDefinition: '' }])('rejects malformed or unsupported definitions', (value) => { expect(() => new HimDefinitionRegistry().register(value as HimMetricDefinition)).toThrow(BadRequestException); });
  it('rejects a duplicate metric identity and version', () => { const registry = new HimDefinitionRegistry(); registry.register(definition('test.metric')); expect(() => registry.register(definition('test.metric'))).toThrow('Duplicate'); });
  it('rejects unresolved, self, and cyclic dependencies without inventing edges', () => {
    expect(() => new HimDefinitionRegistry().register(definition('self', ['self']))).toThrow('itself');
    expect(() => new HimDefinitionRegistry().register(definition('a', ['missing']))).toThrow('Unresolved');
    const registry = new HimDefinitionRegistry(); registry.register(definition('a')); registry.register(definition('b', ['a'])); expect(() => registry.register(definition('a', ['b'], 2))).toThrow('Cyclic');
  });
});
