import { BadRequestException, Injectable } from '@nestjs/common';
import { HimCalculationModelRegistry } from './him-calculation.registry';
import { MAX_HIM_CALCULATION_REFS, type HimMetricCalculationInput, type HimMetricCalculationResult } from './him-calculation.types';
import { calculateHseEnergy,HSE_ENERGY_MODEL_ID,HSE_ENERGY_MODEL_VERSION } from './hse-energy.model';
import { calculateHseMotivation,HSE_MOTIVATION_MODEL_ID,HSE_MOTIVATION_MODEL_VERSION } from './hse-motivation.model';
import { calculateHseAttention,HSE_ATTENTION_MODEL_ID,HSE_ATTENTION_MODEL_VERSION } from './hse-attention.model';
import { calculateHseSelfConfidence,HSE_SELF_CONFIDENCE_MODEL_ID,HSE_SELF_CONFIDENCE_MODEL_VERSION } from './hse-self-confidence.model';
import { calculateHseStress,HSE_STRESS_MODEL_ID,HSE_STRESS_MODEL_VERSION } from './hse-stress.model';
import { calculateHbsAvoidance,HBS_AVOIDANCE_MODEL_ID,HBS_AVOIDANCE_MODEL_VERSION } from './hbs-avoidance.model';
import { calculateHbsConsistency,HBS_CONSISTENCY_MODEL_ID,HBS_CONSISTENCY_MODEL_VERSION } from './hbs-consistency.model';
import { calculateHbsInitiative,HBS_INITIATIVE_MODEL_ID,HBS_INITIATIVE_MODEL_VERSION } from './hbs-initiative.model';
import { calculateHbsReflection,HBS_REFLECTION_MODEL_ID,HBS_REFLECTION_MODEL_VERSION } from './hbs-reflection.model';
import { calculateHrsRelationshipTrust,HRS_RELATIONSHIP_TRUST_MODEL_ID,HRS_RELATIONSHIP_TRUST_MODEL_VERSION } from './hrs-relationship-trust.model';
import { calculateHrsCommunication,HRS_COMMUNICATION_MODEL_ID,HRS_COMMUNICATION_MODEL_VERSION } from './hrs-communication.model';
import { calculateHrsRepair,HRS_REPAIR_MODEL_ID,HRS_REPAIR_MODEL_VERSION } from './hrs-repair.model';
import { calculateHrsEmotionalSafety,HRS_EMOTIONAL_SAFETY_MODEL_ID,HRS_EMOTIONAL_SAFETY_MODEL_VERSION } from './hrs-emotional-safety.model';

const exactContext=(kind:string,id:string)=>kind==='GLOBAL'?id==='GLOBAL':kind==='SITUATION'?id.length>0&&id.length<=128&&id.trim()===id&&id!=='GLOBAL':/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
@Injectable()
export class HimCalculationService {
  constructor(private readonly models:HimCalculationModelRegistry){}
  async calculate(input:HimMetricCalculationInput):Promise<HimMetricCalculationResult>{
    const model=this.models.get(input.modelId,input.modelVersion); if(!model)throw new BadRequestException('Unknown calculation model identity/version.');
    if(model.targetMetricKey!==input.metricKey||model.targetDefinitionVersion!==input.definitionVersion)throw new BadRequestException('Calculation target does not match model.');
    if(!model.supportedContextKinds.includes(input.context.kind)||!exactContext(input.context.kind,input.context.id))throw new BadRequestException('Unsupported exact context.');
    for(const refs of [input.supportingEvidenceRefs,input.contradictoryEvidenceRefs])if(!Array.isArray(refs)||refs.length>MAX_HIM_CALCULATION_REFS||new Set(refs).size!==refs.length)throw new BadRequestException('Invalid evidence references.');
    if(input.supportingEvidenceRefs.some(x=>input.contradictoryEvidenceRefs.includes(x)))throw new BadRequestException('Evidence roles must remain separate.');
    const missing=model.requiredInputKeys.filter(k=>!(k in input.inputs)); const conflict=input.contradictoryEvidenceRefs.length>0;
    // V1 has no production calculator implementation. Missing/conflict always fail closed; a future CALIBRATED implementation may assess.
    if(missing.length||conflict||model.lifecycle!=='CALIBRATED')return this.unassessed(input,missing,conflict);
    if(model.modelId===HSE_ENERGY_MODEL_ID&&model.modelVersion===HSE_ENERGY_MODEL_VERSION){const result=calculateHseEnergy(input);this.validateResult(input,result);return result;}
    if(model.modelId===HSE_MOTIVATION_MODEL_ID&&model.modelVersion===HSE_MOTIVATION_MODEL_VERSION){const result=calculateHseMotivation(input);this.validateResult(input,result);return result;}
    if(model.modelId===HSE_ATTENTION_MODEL_ID&&model.modelVersion===HSE_ATTENTION_MODEL_VERSION){const result=calculateHseAttention(input);this.validateResult(input,result);return result;}
    if(model.modelId===HSE_SELF_CONFIDENCE_MODEL_ID&&model.modelVersion===HSE_SELF_CONFIDENCE_MODEL_VERSION){const result=calculateHseSelfConfidence(input);this.validateResult(input,result);return result;}
    if(model.modelId===HSE_STRESS_MODEL_ID&&model.modelVersion===HSE_STRESS_MODEL_VERSION){const result=calculateHseStress(input);this.validateResult(input,result);return result;}
    if(model.modelId===HBS_AVOIDANCE_MODEL_ID&&model.modelVersion===HBS_AVOIDANCE_MODEL_VERSION){const result=calculateHbsAvoidance(input);this.validateResult(input,result);return result;}
    if(model.modelId===HBS_CONSISTENCY_MODEL_ID&&model.modelVersion===HBS_CONSISTENCY_MODEL_VERSION){const result=calculateHbsConsistency(input);this.validateResult(input,result);return result;}
    if(model.modelId===HBS_INITIATIVE_MODEL_ID&&model.modelVersion===HBS_INITIATIVE_MODEL_VERSION){const result=calculateHbsInitiative(input);this.validateResult(input,result);return result;}
    if(model.modelId===HBS_REFLECTION_MODEL_ID&&model.modelVersion===HBS_REFLECTION_MODEL_VERSION){const result=calculateHbsReflection(input);this.validateResult(input,result);return result;}
    if(model.modelId===HRS_RELATIONSHIP_TRUST_MODEL_ID&&model.modelVersion===HRS_RELATIONSHIP_TRUST_MODEL_VERSION){const result=calculateHrsRelationshipTrust(input);this.validateResult(input,result);return result;}
    if(model.modelId===HRS_COMMUNICATION_MODEL_ID&&model.modelVersion===HRS_COMMUNICATION_MODEL_VERSION){const result=calculateHrsCommunication(input);this.validateResult(input,result);return result;}
    if(model.modelId===HRS_REPAIR_MODEL_ID&&model.modelVersion===HRS_REPAIR_MODEL_VERSION){const result=calculateHrsRepair(input);this.validateResult(input,result);return result;}
    if(model.modelId===HRS_EMOTIONAL_SAFETY_MODEL_ID&&model.modelVersion===HRS_EMOTIONAL_SAFETY_MODEL_VERSION){const result=calculateHrsEmotionalSafety(input);this.validateResult(input,result);return result;}
    throw new BadRequestException('No approved deterministic implementation is registered.');
  }
  validateResult(input:HimMetricCalculationInput,result:HimMetricCalculationResult):void {
    if(result.modelId!==input.modelId||result.modelVersion!==input.modelVersion||result.metricKey!==input.metricKey||result.definitionVersion!==input.definitionVersion||result.context.kind!==input.context.kind||result.context.id!==input.context.id)throw new BadRequestException('Calculator result identity mismatch.');
    if(result.resultState==='UNASSESSED'&&result.numericValue!==null)throw new BadRequestException('Unassessed result cannot be numeric.');
    if(result.resultState==='ASSESSED'&&(!Number.isFinite(result.numericValue)||this.models.get(input.modelId,input.modelVersion)?.lifecycle!=='CALIBRATED'))throw new BadRequestException('Assessed result requires a calibrated model and finite value.');
    if(result.provenance!==input.provenance||result.confidenceState!=='UNASSESSED'||result.confidenceReference!==null)throw new BadRequestException('Invalid server-controlled provenance/confidence boundary.');
  }
  private unassessed(i:HimMetricCalculationInput,missing:string[],conflict:boolean):HimMetricCalculationResult{return{metricKey:i.metricKey,definitionVersion:i.definitionVersion,modelId:i.modelId,modelVersion:i.modelVersion,context:{...i.context},resultState:'UNASSESSED',numericValue:null,missingInputKeys:missing,contradictionState:conflict?'PRESENT_UNRESOLVED':'NONE',supportingEvidenceRefs:[...i.supportingEvidenceRefs],contradictoryEvidenceRefs:[...i.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:i.provenance,confidenceState:'UNASSESSED',confidenceReference:null,traceId:i.traceId,updateReason:i.updateReason};}
}

