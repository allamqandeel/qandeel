import { BadRequestException } from '@nestjs/common';
import { HimDefinitionRegistry } from './him-definition.registry';
import { CANONICAL_HIM_V1_METRICS, HIM_METRIC_CATALOG } from './initial-him-metrics.catalog';
import type { HimMetricDefinition } from './him.types';
// QHIM-010. Two permanently different concepts:
//
//   * CANONICAL_HIM_V1_METRICS - the frozen seventeen `metricKey@1` identities.
//     A closed historical/foundation set, so exact claims about it are legal
//     and the facts below (all calibrated, the exact 6/11 semantic mapping
//     population, every scale and input contract) are scoped to it alone.
//   * HIM_METRIC_CATALOG - the complete, EXTENSIBLE application catalog and the
//     registry's initialization input. It may legitimately gain a later version
//     of an existing metric, an entirely new reviewed metric, and definitions
//     still UNCALIBRATED while they wait for their own calibration task, so
//     nothing here imposes today's population on it as a ceiling.
//
// Identity is (metricKey, definitionVersion), never metricKey alone.
const identityOf=(definition:{metricKey:string;definitionVersion:number}):string=>`${definition.metricKey}@${definition.definitionVersion}`;
const expected=['hse.stress@1','hse.energy@1','hse.motivation@1','hse.self-confidence@1','hse.attention@1','hbs.avoidance@1','hbs.consistency@1','hbs.initiative@1','hbs.reflection@1','hrs.relationship-trust@1','hrs.communication@1','hrs.repair@1','hrs.emotional-safety@1','hgs.self-awareness@1','hgs.resilience@1','hgs.purpose-alignment@1','hgs.habit-strength@1'];
describe('Initial HIM catalog',()=>{
  it('requires the exact seventeen canonical v1 identities as a version-exact subset',()=>{expect(CANONICAL_HIM_V1_METRICS.map(identityOf)).toEqual(expected);expect(new HimDefinitionRegistry().list().map(identityOf)).toEqual(expect.arrayContaining(expected));});
  // Initialization is proven against the catalog itself: every application
  // catalog definition is registered under its exact identity. No hard-coded
  // global count, so a later reviewed definition simply joins the registry.
  it('registers every application catalog definition under its exact identity',()=>{expect(new HimDefinitionRegistry().list().map(identityOf)).toEqual(HIM_METRIC_CATALOG.map(identityOf));expect(new Set(HIM_METRIC_CATALOG.map(identityOf)).size).toBe(HIM_METRIC_CATALOG.length);});
  it('contains no bridge-only examples',()=>expect(new HimDefinitionRegistry().list().map(x=>x.canonicalName)).not.toEqual(expect.arrayContaining(['Decision Clarity','Action Readiness','Goal Alignment','Decision Quality','Uncertainty','Progress','Cognitive Load','Relationship Health','Growth Momentum','Sleep'])));
  it('activates all seventeen calibrated structured metrics with no metric left uncalibrated',()=>{
    const stress=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hse.stress')!;
    expect(stress.calculationStatus).toBe('CALIBRATED');
    expect(stress.scaleReference).toBe('hse.stress.ordinal-5.v1');
    const energy=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hse.energy')!;
    expect(energy.calculationStatus).toBe('CALIBRATED');
    expect(energy.scaleReference).toBe('hse.energy.ordinal-5.v1');
    expect(energy.requiredInputContract).toBe('DIRECT_STRUCTURED_USER_REPORT_AR_EG_RIGHT_NOW_V1');
    const motivation=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hse.motivation')!;
    expect(motivation.calculationStatus).toBe('CALIBRATED');
    expect(motivation.scaleReference).toBe('hse.motivation.ordinal-5.v1');
    const attention=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hse.attention')!;
    expect(attention.calculationStatus).toBe('CALIBRATED');
    expect(attention.scaleReference).toBe('hse.attention.ordinal-5.v1');
    const selfConfidence=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hse.self-confidence')!;
    expect(selfConfidence.calculationStatus).toBe('CALIBRATED');
    expect(selfConfidence.scaleReference).toBe('hse.self-confidence.ordinal-5.v1');
    // HBS Avoidance is calibrated while its Foundation semantic mapping stays
    // deliberately unresolved: calibration and semantic mapping are independent.
    const avoidance=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hbs.avoidance')!;
    expect(avoidance.calculationStatus).toBe('CALIBRATED');
    expect(avoidance.scaleReference).toBe('hbs.avoidance.frequency-5.v1');
    expect(avoidance.requiredInputContract).toBe('DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1');
    expect(avoidance.hifOwner).toBe('HBS');
    expect(avoidance.semanticMappingStatus).toBe('UNRESOLVED');
    expect(avoidance.semanticType).toBeNull();
    expect(avoidance.validContextKinds).toEqual(['SITUATION','GOAL']);
    // HBS Consistency and Initiative are calibrated as two fully independent
    // sibling constructs (each with its own scale) while their Foundation
    // semantic mapping stays deliberately unresolved, exactly like Avoidance.
    for(const[metricKey,scaleReference]of[['hbs.consistency','hbs.consistency.frequency-5.v1'],['hbs.initiative','hbs.initiative.frequency-5.v1']] as const){
      const definition=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey===metricKey)!;
      expect(definition.calculationStatus).toBe('CALIBRATED');
      expect(definition.scaleReference).toBe(scaleReference);
      expect(definition.requiredInputContract).toBe('DIRECT_STRUCTURED_TARGET_BOUND_PERIOD_USER_REPORT_SEVEN_DAY_V1');
      expect(definition.hifOwner).toBe('HBS');
      expect(definition.semanticMappingStatus).toBe('UNRESOLVED');
      expect(definition.semanticType).toBeNull();
      expect(definition.validContextKinds).toEqual(['SITUATION','GOAL']);
    }
    // HBS Reflection is calibrated as a context-bound at-report deliberate
    // reflective-engagement construct: SITUATION/CONVERSATION_SESSION only,
    // no seven-day period contract, and its Foundation semantic mapping
    // stays deliberately unresolved - it is not rumination, Self-awareness,
    // or insight accuracy.
    const reflection=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hbs.reflection')!;
    expect(reflection.calculationStatus).toBe('CALIBRATED');
    expect(reflection.scaleReference).toBe('hbs.reflection.engagement-5.v1');
    expect(reflection.requiredInputContract).toBe('DIRECT_STRUCTURED_AUTHORIZED_CONTEXT_REFLECTIVE_ENGAGEMENT_REPORT_V1');
    expect(reflection.hifOwner).toBe('HBS');
    expect(reflection.semanticMappingStatus).toBe('UNRESOLVED');
    expect(reflection.semanticType).toBeNull();
    expect(reflection.validContextKinds).toEqual(['SITUATION','CONVERSATION_SESSION']);
    // HRS Relationship Trust is calibrated as a relationship-bound current
    // reliance appraisal: exactly one owned RELATIONSHIP target, no temporal
    // window, and its Foundation semantic mapping stays deliberately
    // unresolved - the RELATIONSHIP context kind is not a semantic type, and
    // it is not objective trustworthiness, global propensity to trust,
    // love/closeness, Emotional Safety, Communication, or Repair.
    const relationshipTrust=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hrs.relationship-trust')!;
    expect(relationshipTrust.calculationStatus).toBe('CALIBRATED');
    expect(relationshipTrust.scaleReference).toBe('hrs.relationship-trust.reliance-5.v1');
    expect(relationshipTrust.requiredInputContract).toBe('DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_RELIANCE_REPORT_V1');
    expect(relationshipTrust.hifOwner).toBe('HRS');
    expect(relationshipTrust.semanticMappingStatus).toBe('UNRESOLVED');
    expect(relationshipTrust.semanticType).toBeNull();
    expect(relationshipTrust.validContextKinds).toEqual(['RELATIONSHIP']);
    // HRS Communication and Repair are calibrated as two fully independent
    // relationship-bound at-report constructs (each with its own scale and
    // input contract - nothing is shared even though both are ordinal 1-5)
    // while their Foundation semantic mappings stay deliberately unresolved:
    // Communication is not talking frequency, agreement, satisfaction,
    // Trust, or Repair; Repair is not absence of conflict, forgiveness,
    // reconciliation, Communication quality, or Trust.
    const communication=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hrs.communication')!;
    expect(communication.calculationStatus).toBe('CALIBRATED');
    expect(communication.scaleReference).toBe('hrs.communication.workability-5.v1');
    expect(communication.requiredInputContract).toBe('DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_COMMUNICATION_WORKABILITY_REPORT_V1');
    expect(communication.hifOwner).toBe('HRS');
    expect(communication.semanticMappingStatus).toBe('UNRESOLVED');
    expect(communication.semanticType).toBeNull();
    expect(communication.validContextKinds).toEqual(['RELATIONSHIP']);
    const repair=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hrs.repair')!;
    expect(repair.calculationStatus).toBe('CALIBRATED');
    expect(repair.scaleReference).toBe('hrs.repair.effectiveness-5.v1');
    expect(repair.requiredInputContract).toBe('DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_REPAIR_EFFECTIVENESS_REPORT_V1');
    expect(repair.hifOwner).toBe('HRS');
    expect(repair.semanticMappingStatus).toBe('UNRESOLVED');
    expect(repair.semanticType).toBeNull();
    expect(repair.validContextKinds).toEqual(['RELATIONSHIP']);
    // HRS Emotional Safety is calibrated as a relationship-bound current
    // perceived-safety-for-emotional-openness appraisal and completes the
    // HRS family: exactly one owned RELATIONSHIP target, no temporal
    // window, and its Foundation semantic mapping stays deliberately
    // unresolved - it is subjective perceived safety of emotional exposure
    // only, never objective/physical/abuse safety, never an abuse or danger
    // classifier, never relationship health, never Trust, Communication, or
    // Repair, and never Safety Runtime authority.
    const emotionalSafety=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hrs.emotional-safety')!;
    expect(emotionalSafety.calculationStatus).toBe('CALIBRATED');
    expect(emotionalSafety.scaleReference).toBe('hrs.emotional-safety.openness-safety-5.v1');
    expect(emotionalSafety.requiredInputContract).toBe('DIRECT_STRUCTURED_RELATIONSHIP_BOUND_CURRENT_EMOTIONAL_OPENNESS_SAFETY_REPORT_V1');
    expect(emotionalSafety.hifOwner).toBe('HRS');
    expect(emotionalSafety.semanticMappingStatus).toBe('UNRESOLVED');
    expect(emotionalSafety.semanticType).toBeNull();
    expect(emotionalSafety.validContextKinds).toEqual(['RELATIONSHIP']);
    // HGS Self-Awareness is calibrated as a target-bound current perceived
    // self-understanding-clarity appraisal and opens the HGS family:
    // exactly one owned GOAL or SITUATION target, no temporal window, and
    // its Foundation semantic mapping stays deliberately unresolved - it
    // measures perceived clarity only, never Reflection (the deliberate
    // reflective process), rumination, Self-Confidence, objective insight
    // accuracy, or growth outcome, and it is not force-mapped to
    // CAPABILITY merely because it sounds like an ability.
    const selfAwareness=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hgs.self-awareness')!;
    expect(selfAwareness.calculationStatus).toBe('CALIBRATED');
    expect(selfAwareness.scaleReference).toBe('hgs.self-awareness.clarity-5.v1');
    expect(selfAwareness.requiredInputContract).toBe('DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_SELF_UNDERSTANDING_CLARITY_REPORT_V1');
    expect(selfAwareness.hifOwner).toBe('HGS');
    expect(selfAwareness.semanticMappingStatus).toBe('UNRESOLVED');
    expect(selfAwareness.semanticType).toBeNull();
    expect(selfAwareness.validContextKinds).toEqual(['GOAL','SITUATION']);
    expect(selfAwareness.dependencyIds).toEqual([]);
    expect(selfAwareness.consumers).toEqual([]);
    // HGS Resilience is calibrated as a target-bound current
    // adaptive-recovery appraisal under actually experienced challenge:
    // exactly one owned GOAL or SITUATION target, no temporal window or
    // recovery-time score, and its Foundation semantic mapping stays
    // deliberately unresolved - it measures perceived adaptive
    // continuity/recovery only, never low Stress, Motivation,
    // Self-Confidence, Consistency, Habit Strength, grit, goal success,
    // HRS Repair, or a global resilience trait, and it is not force-mapped
    // to CAPABILITY or TRAIT merely because it sounds like toughness.
    const resilience=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hgs.resilience')!;
    expect(resilience.calculationStatus).toBe('CALIBRATED');
    expect(resilience.scaleReference).toBe('hgs.resilience.adaptive-recovery-5.v1');
    expect(resilience.requiredInputContract).toBe('DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_ADAPTIVE_RECOVERY_REPORT_V1');
    expect(resilience.hifOwner).toBe('HGS');
    expect(resilience.semanticMappingStatus).toBe('UNRESOLVED');
    expect(resilience.semanticType).toBeNull();
    expect(resilience.validContextKinds).toEqual(['GOAL','SITUATION']);
    expect(resilience.dependencyIds).toEqual([]);
    expect(resilience.consumers).toEqual([]);
    // HGS Purpose Alignment is calibrated as a goal-bound current
    // perceived purpose-congruence appraisal: exactly one owned GOAL
    // target, no temporal window, and - unlike Self-Awareness and
    // Resilience - its Foundation semantic mapping is ALREADY RESOLVED as
    // ALIGNMENT and is preserved exactly (never downgraded to
    // UNRESOLVED/null and never remapped): it measures perceived
    // congruence with personally meaningful values/priorities/direction
    // only, never Motivation, Self-Awareness, Resilience, Consistency,
    // Habit Strength, goal importance, goal success, or moral/safety
    // approval, and no motive-subscale weighting or value hierarchy
    // exists.
    const purposeAlignment=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hgs.purpose-alignment')!;
    expect(purposeAlignment.calculationStatus).toBe('CALIBRATED');
    expect(purposeAlignment.scaleReference).toBe('hgs.purpose-alignment.congruence-5.v1');
    expect(purposeAlignment.requiredInputContract).toBe('DIRECT_STRUCTURED_GOAL_BOUND_CURRENT_PURPOSE_CONGRUENCE_REPORT_V1');
    expect(purposeAlignment.hifOwner).toBe('HGS');
    expect(purposeAlignment.semanticMappingStatus).toBe('RESOLVED');
    expect(purposeAlignment.semanticType).toBe('ALIGNMENT');
    expect(purposeAlignment.validContextKinds).toEqual(['GOAL']);
    expect(purposeAlignment.dependencyIds).toEqual([]);
    expect(purposeAlignment.consumers).toEqual([]);
    // HGS Habit Strength is calibrated as a target-bound current
    // cue-linked-automaticity appraisal of one specific recurring
    // action/routine grounded in sufficient repeated experience, and
    // completes the canonical 17-metric v1 measurement inventory: exactly
    // one owned GOAL or SITUATION target, no temporal window, streak,
    // repetition count, or time-to-habit score, and its Foundation
    // semantic mapping stays deliberately unresolved - it measures
    // perceived cue-linked automaticity only, never Consistency,
    // follow-through frequency, Initiative, Motivation, Purpose
    // Alignment, discipline, grit, compulsion, or addiction, and it is
    // not force-mapped to TRAIT or CAPABILITY (and no HABIT or
    // AUTOMATICITY semantic type is invented) merely because it sounds
    // like a stable disposition.
    const habitStrength=CANONICAL_HIM_V1_METRICS.find(x=>x.metricKey==='hgs.habit-strength')!;
    expect(habitStrength.calculationStatus).toBe('CALIBRATED');
    expect(habitStrength.scaleReference).toBe('hgs.habit-strength.automaticity-5.v1');
    expect(habitStrength.requiredInputContract).toBe('DIRECT_STRUCTURED_TARGET_BOUND_CURRENT_CUE_LINKED_AUTOMATICITY_REPORT_V1');
    expect(habitStrength.hifOwner).toBe('HGS');
    expect(habitStrength.semanticMappingStatus).toBe('UNRESOLVED');
    expect(habitStrength.semanticType).toBeNull();
    expect(habitStrength.validContextKinds).toEqual(['GOAL','SITUATION']);
    expect(habitStrength.dependencyIds).toEqual([]);
    expect(habitStrength.consumers).toEqual([]);
    // The canonical v1 measurement inventory is complete AS A FROZEN
    // HISTORICAL SET: every one of the 17 `metricKey@1` identities is
    // calibrated with its own production scale. This is scoped to
    // CANONICAL_HIM_V1_METRICS and is deliberately NOT a claim that the
    // application catalog contains nothing uncalibrated - a later reviewed
    // definition may sit UNCALIBRATED there while it awaits its own
    // calibration task without falsifying anything below.
    expect(CANONICAL_HIM_V1_METRICS.every(x=>x.definitionVersion===1)).toBe(true);
    expect(CANONICAL_HIM_V1_METRICS.filter(x=>x.calculationStatus!=='CALIBRATED')).toEqual([]);
    expect(CANONICAL_HIM_V1_METRICS.filter(x=>x.scaleReference==='UNCALIBRATED_NO_PRODUCTION_SCALE')).toEqual([]);
    CANONICAL_HIM_V1_METRICS.forEach(x=>{
      expect(x.confidenceRequirementReference).toBe('UNRESOLVED_METRIC_CONFIDENCE_MODEL');
      expect(x.dependencyIds).toEqual([]);
    });
  });
  it('disambiguates Confidence and relationship-scopes Trust',()=>{const confidence=CANONICAL_HIM_V1_METRICS.find(x=>x.canonicalName==='Confidence')!;expect(confidence.metricKey).toBe('hse.self-confidence');expect(confidence.validContextKinds).not.toContain('GLOBAL');const trust=CANONICAL_HIM_V1_METRICS.find(x=>x.canonicalName==='Trust')!;expect(trust.metricKey).toBe('hrs.relationship-trust');expect(trust.validContextKinds).toEqual(['RELATIONSHIP']);});
  // The exact 6/11 semantic mapping population is CANONICAL V1 truth, scoped to
  // the frozen seventeen `metricKey@1` identities. A later reviewed definition
  // is never forced into this population.
  it('resolves only canonically supported semantic mappings',()=>{const resolved=CANONICAL_HIM_V1_METRICS.filter(x=>x.semanticMappingStatus==='RESOLVED');expect(resolved.map(x=>[x.metricKey,x.semanticType])).toEqual([['hse.stress','STATE'],['hse.energy','STATE'],['hse.motivation','STATE'],['hse.self-confidence','STATE'],['hse.attention','STATE'],['hgs.purpose-alignment','ALIGNMENT']]);const unresolved=CANONICAL_HIM_V1_METRICS.filter(x=>x.semanticMappingStatus==='UNRESOLVED');expect(unresolved).toHaveLength(11);expect(unresolved.every(x=>x.semanticType===null)).toBe(true);});
  it('rejects inconsistent resolved and unresolved mapping pairs',()=>{const registry=new HimDefinitionRegistry();expect(()=>registry.register({...CANONICAL_HIM_V1_METRICS[0],metricKey:'forged.unresolved',semanticMappingStatus:'UNRESOLVED'})).toThrow('semantic mapping');expect(()=>registry.register({...CANONICAL_HIM_V1_METRICS[5],metricKey:'forged.resolved',semanticMappingStatus:'RESOLVED'})).toThrow('semantic mapping');});
  it('rejects forged canonical metadata',()=>{const registry=new HimDefinitionRegistry();const value={...CANONICAL_HIM_V1_METRICS[0],metricKey:'forged.metric',hifOwner:'ABS'};expect(()=>registry.register(value as HimMetricDefinition)).toThrow(BadRequestException);});
  // --- QHIM-010: the application catalog is extensible ----------------------
  //
  // Permanent registry invariant, unchanged by this task and proven both ways:
  //   same metricKey + same definitionVersion => duplicate => reject
  //   same metricKey + different definitionVersion => legal if otherwise valid
  //
  // `get(k,v)` stays exact: it never falls back to a latest version, and
  // version 1 is not globally mandatory for a future definition.
  const futureDefinition=(metricKey:string,definitionVersion:number,calculationStatus:'CALIBRATED'|'UNCALIBRATED'):HimMetricDefinition=>({...CANONICAL_HIM_V1_METRICS[1],metricKey,definitionVersion,calculationStatus,scaleReference:calculationStatus==='CALIBRATED'?`${metricKey}.synthetic-5.v${definitionVersion}`:'UNCALIBRATED_NO_PRODUCTION_SCALE'});
  it('rejects an exact duplicate metric identity and version',()=>{const registry=new HimDefinitionRegistry();expect(()=>registry.register(futureDefinition('hse.energy',1,'CALIBRATED'))).toThrow('Duplicate HIM metric identity/version.');});
  it('accepts a later version of an existing metric while version lookup stays exact',()=>{const registry=new HimDefinitionRegistry();registry.register(futureDefinition('hse.energy',2,'CALIBRATED'));
    expect(registry.get('hse.energy',2)?.definitionVersion).toBe(2);
    expect(registry.get('hse.energy',2)?.scaleReference).toBe('hse.energy.synthetic-5.v2');
    // hse.energy@2 neither replaces nor satisfies hse.energy@1.
    expect(registry.get('hse.energy',1)?.scaleReference).toBe('hse.energy.ordinal-5.v1');
    expect(registry.get('hse.energy',3)).toBeUndefined();
    expect(registry.list().map(identityOf)).toEqual(expect.arrayContaining(expected));
    expect(CANONICAL_HIM_V1_METRICS.map(identityOf)).toEqual(expected);});
  it('accepts calibrated and uncalibrated future definitions without disturbing canonical v1',()=>{const registry=new HimDefinitionRegistry();
    registry.register(futureDefinition('hse.energy',2,'UNCALIBRATED'));
    registry.register(futureDefinition('hse.future-appraisal',1,'CALIBRATED'));
    registry.register(futureDefinition('hse.second-future-appraisal',1,'UNCALIBRATED'));
    const identities=registry.list().map(identityOf);
    expect(identities).toEqual(expect.arrayContaining([...expected,'hse.energy@2','hse.future-appraisal@1','hse.second-future-appraisal@1']));
    // The registry really does hold uncalibrated definitions now, and every
    // canonical v1 identity is still present and still CALIBRATED.
    expect(registry.list().filter(x=>x.calculationStatus!=='CALIBRATED').length).toBe(2);
    for(const definition of CANONICAL_HIM_V1_METRICS)expect(registry.get(definition.metricKey,1)?.calculationStatus).toBe('CALIBRATED');});
  it('does not make definition version 1 mandatory for a future definition',()=>{const registry=new HimDefinitionRegistry();registry.register(futureDefinition('hse.future-appraisal',4,'UNCALIBRATED'));expect(registry.get('hse.future-appraisal',4)?.definitionVersion).toBe(4);expect(registry.get('hse.future-appraisal',1)).toBeUndefined();});
});

