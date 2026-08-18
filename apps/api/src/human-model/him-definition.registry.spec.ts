import { BadRequestException } from '@nestjs/common';
import { HimDefinitionRegistry } from './him-definition.registry';
import { INITIAL_HIM_METRICS } from './initial-him-metrics.catalog';
import type { HimMetricDefinition } from './him.types';
const expected=['hse.stress','hse.energy','hse.motivation','hse.self-confidence','hse.attention','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
describe('Initial HIM catalog',()=>{
  it('registers exactly the 17 canonical identities',()=>expect(new HimDefinitionRegistry().list().map(x=>x.metricKey)).toEqual(expected));
  it('contains no bridge-only examples',()=>expect(new HimDefinitionRegistry().list().map(x=>x.canonicalName)).not.toEqual(expect.arrayContaining(['Decision Clarity','Action Readiness','Goal Alignment','Decision Quality','Uncertainty','Progress','Cognitive Load','Relationship Health','Growth Momentum','Sleep'])));
  it('is entirely uncalibrated with no scale, confidence formula, or dependency edge',()=>INITIAL_HIM_METRICS.forEach(x=>{expect(x.calculationStatus).toBe('UNCALIBRATED');expect(x.scaleReference).toBe('UNCALIBRATED_NO_PRODUCTION_SCALE');expect(x.confidenceRequirementReference).toBe('UNRESOLVED_METRIC_CONFIDENCE_MODEL');expect(x.dependencyIds).toEqual([]);}));
  it('disambiguates Confidence and relationship-scopes Trust',()=>{const confidence=INITIAL_HIM_METRICS.find(x=>x.canonicalName==='Confidence')!;expect(confidence.metricKey).toBe('hse.self-confidence');expect(confidence.validContextKinds).not.toContain('GLOBAL');const trust=INITIAL_HIM_METRICS.find(x=>x.canonicalName==='Trust')!;expect(trust.metricKey).toBe('hrs.relationship-trust');expect(trust.validContextKinds).toEqual(['RELATIONSHIP']);});
  it('rejects forged canonical metadata',()=>{const registry=new HimDefinitionRegistry();const value={...INITIAL_HIM_METRICS[0],metricKey:'forged.metric',hifOwner:'ABS'};expect(()=>registry.register(value as HimMetricDefinition)).toThrow(BadRequestException);});
});

