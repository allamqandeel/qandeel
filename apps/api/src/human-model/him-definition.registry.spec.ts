import { BadRequestException } from '@nestjs/common';
import { HimDefinitionRegistry } from './him-definition.registry';
import { INITIAL_HIM_METRICS } from './initial-him-metrics.catalog';
import type { HimMetricDefinition } from './him.types';
const expected=['hse.stress','hse.energy','hse.motivation','hse.self-confidence','hse.attention','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
describe('Initial HIM catalog',()=>{
  it('registers exactly the 17 canonical identities',()=>expect(new HimDefinitionRegistry().list().map(x=>x.metricKey)).toEqual(expected));
  it('contains no bridge-only examples',()=>expect(new HimDefinitionRegistry().list().map(x=>x.canonicalName)).not.toEqual(expect.arrayContaining(['Decision Clarity','Action Readiness','Goal Alignment','Decision Quality','Uncertainty','Progress','Cognitive Load','Relationship Health','Growth Momentum','Sleep'])));
  it('activates five structured HSE metrics while leaving 12 metrics uncalibrated',()=>{
    const stress=INITIAL_HIM_METRICS.find(x=>x.metricKey==='hse.stress')!;
    expect(stress.calculationStatus).toBe('CALIBRATED');
    expect(stress.scaleReference).toBe('hse.stress.ordinal-5.v1');
    const energy=INITIAL_HIM_METRICS.find(x=>x.metricKey==='hse.energy')!;
    expect(energy.calculationStatus).toBe('CALIBRATED');
    expect(energy.scaleReference).toBe('hse.energy.ordinal-5.v1');
    expect(energy.requiredInputContract).toBe('DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1');
    const motivation=INITIAL_HIM_METRICS.find(x=>x.metricKey==='hse.motivation')!;
    expect(motivation.calculationStatus).toBe('CALIBRATED');
    expect(motivation.scaleReference).toBe('hse.motivation.ordinal-5.v1');
    const attention=INITIAL_HIM_METRICS.find(x=>x.metricKey==='hse.attention')!;
    expect(attention.calculationStatus).toBe('CALIBRATED');
    expect(attention.scaleReference).toBe('hse.attention.ordinal-5.v1');
    const selfConfidence=INITIAL_HIM_METRICS.find(x=>x.metricKey==='hse.self-confidence')!;
    expect(selfConfidence.calculationStatus).toBe('CALIBRATED');
    expect(selfConfidence.scaleReference).toBe('hse.self-confidence.ordinal-5.v1');
    INITIAL_HIM_METRICS.filter(x=>!['hse.stress','hse.energy','hse.motivation','hse.attention','hse.self-confidence'].includes(x.metricKey)).forEach(x=>{
      expect(x.calculationStatus).toBe('UNCALIBRATED');
      expect(x.scaleReference).toBe('UNCALIBRATED_NO_PRODUCTION_SCALE');
    });
    INITIAL_HIM_METRICS.forEach(x=>{
      expect(x.confidenceRequirementReference).toBe('UNRESOLVED_METRIC_CONFIDENCE_MODEL');
      expect(x.dependencyIds).toEqual([]);
    });
  });
  it('disambiguates Confidence and relationship-scopes Trust',()=>{const confidence=INITIAL_HIM_METRICS.find(x=>x.canonicalName==='Confidence')!;expect(confidence.metricKey).toBe('hse.self-confidence');expect(confidence.validContextKinds).not.toContain('GLOBAL');const trust=INITIAL_HIM_METRICS.find(x=>x.canonicalName==='Trust')!;expect(trust.metricKey).toBe('hrs.relationship-trust');expect(trust.validContextKinds).toEqual(['RELATIONSHIP']);});
  it('resolves only canonically supported semantic mappings',()=>{const resolved=INITIAL_HIM_METRICS.filter(x=>x.semanticMappingStatus==='RESOLVED');expect(resolved.map(x=>[x.metricKey,x.semanticType])).toEqual([['hse.stress','STATE'],['hse.energy','STATE'],['hse.motivation','STATE'],['hse.self-confidence','STATE'],['hse.attention','STATE'],['hgs.purpose-alignment','ALIGNMENT']]);const unresolved=INITIAL_HIM_METRICS.filter(x=>x.semanticMappingStatus==='UNRESOLVED');expect(unresolved).toHaveLength(11);expect(unresolved.every(x=>x.semanticType===null)).toBe(true);});
  it('rejects inconsistent resolved and unresolved mapping pairs',()=>{const registry=new HimDefinitionRegistry();expect(()=>registry.register({...INITIAL_HIM_METRICS[0],metricKey:'forged.unresolved',semanticMappingStatus:'UNRESOLVED'})).toThrow('semantic mapping');expect(()=>registry.register({...INITIAL_HIM_METRICS[5],metricKey:'forged.resolved',semanticMappingStatus:'RESOLVED'})).toThrow('semantic mapping');});
  it('rejects forged canonical metadata',()=>{const registry=new HimDefinitionRegistry();const value={...INITIAL_HIM_METRICS[0],metricKey:'forged.metric',hifOwner:'ABS'};expect(()=>registry.register(value as HimMetricDefinition)).toThrow(BadRequestException);});
});
