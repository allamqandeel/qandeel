import { BadRequestException, Injectable } from '@nestjs/common';
import { HimDefinitionRegistry } from './him-definition.registry';
import { HIM_CONFIDENCE_CONTRACTS, HIM_CONTRADICTION_BEHAVIORS, HIM_MISSING_BEHAVIORS, HIM_MODEL_ENVIRONMENTS, HIM_MODEL_LIFECYCLES, type HimCalculationModel, type HimCalibrationApproval } from './him-calculation.types';
import { HIM_CONTEXT_KINDS } from './him.types';
import { HSE_ENERGY_MODEL } from './hse-energy.model';
import { HSE_MOTIVATION_MODEL } from './hse-motivation.model';
import { HSE_ATTENTION_MODEL } from './hse-attention.model';
import { HSE_SELF_CONFIDENCE_MODEL } from './hse-self-confidence.model';
import { HSE_STRESS_MODEL } from './hse-stress.model';
import { HBS_AVOIDANCE_MODEL } from './hbs-avoidance.model';
import { HBS_CONSISTENCY_MODEL } from './hbs-consistency.model';
import { HBS_INITIATIVE_MODEL } from './hbs-initiative.model';
import { HBS_REFLECTION_MODEL } from './hbs-reflection.model';
import { HRS_RELATIONSHIP_TRUST_MODEL } from './hrs-relationship-trust.model';
import { HRS_COMMUNICATION_MODEL } from './hrs-communication.model';
import { HRS_REPAIR_MODEL } from './hrs-repair.model';

const ID=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/; const bounded=(v:unknown,n:number,f:string)=>{if(typeof v!=='string'||v.trim()!==v||!v.length||v.length>n)throw new BadRequestException(`Invalid ${f}.`);return v;};
@Injectable()
export class HimCalculationModelRegistry {
  private readonly models=new Map<string,HimCalculationModel>();
  constructor(private readonly definitions:HimDefinitionRegistry){const energy=this.definitions.get('hse.energy',1);if(energy?.metricKey==='hse.energy')this.register(HSE_ENERGY_MODEL);const motivation=this.definitions.get('hse.motivation',1);if(motivation?.metricKey==='hse.motivation')this.register(HSE_MOTIVATION_MODEL);const attention=this.definitions.get('hse.attention',1);if(attention?.metricKey==='hse.attention')this.register(HSE_ATTENTION_MODEL);const selfConfidence=this.definitions.get('hse.self-confidence',1);if(selfConfidence?.metricKey==='hse.self-confidence')this.register(HSE_SELF_CONFIDENCE_MODEL);const stress=this.definitions.get('hse.stress',1);if(stress?.metricKey==='hse.stress')this.register(HSE_STRESS_MODEL);const avoidance=this.definitions.get('hbs.avoidance',1);if(avoidance?.metricKey==='hbs.avoidance')this.register(HBS_AVOIDANCE_MODEL);const consistency=this.definitions.get('hbs.consistency',1);if(consistency?.metricKey==='hbs.consistency')this.register(HBS_CONSISTENCY_MODEL);const initiative=this.definitions.get('hbs.initiative',1);if(initiative?.metricKey==='hbs.initiative')this.register(HBS_INITIATIVE_MODEL);const reflection=this.definitions.get('hbs.reflection',1);if(reflection?.metricKey==='hbs.reflection')this.register(HBS_REFLECTION_MODEL);const relationshipTrust=this.definitions.get('hrs.relationship-trust',1);if(relationshipTrust?.metricKey==='hrs.relationship-trust')this.register(HRS_RELATIONSHIP_TRUST_MODEL);const communication=this.definitions.get('hrs.communication',1);if(communication?.metricKey==='hrs.communication')this.register(HRS_COMMUNICATION_MODEL);const repair=this.definitions.get('hrs.repair',1);if(repair?.metricKey==='hrs.repair')this.register(HRS_REPAIR_MODEL);}
  register(model:HimCalculationModel):void {
    this.validate(model); const identity=`${model.modelId}@${model.modelVersion}`;
    if(this.models.has(identity))throw new BadRequestException('Duplicate HIM calculation model identity/version.');
    const definition=this.definitions.get(model.targetMetricKey,model.targetDefinitionVersion);
    if(!definition)throw new BadRequestException('Unknown target metric identity/version.');
    if(model.environment==='TEST_ONLY' && !model.targetMetricKey.startsWith('test.synthetic.'))throw new BadRequestException('Test-only models cannot bind production metrics.');
    if(model.environment==='PRODUCTION' && model.targetMetricKey.startsWith('test.synthetic.'))throw new BadRequestException('Production models cannot bind test metrics.');
    if(model.supportedContextKinds.some(k=>!definition.validContextKinds.includes(k)))throw new BadRequestException('Model context contract exceeds target metric contexts.');
    this.models.set(identity,Object.freeze({...model,requiredInputKeys:[...model.requiredInputKeys],supportedContextKinds:[...model.supportedContextKinds]}));
  }
  get(id:string,version:number){return this.models.get(`${id}@${version}`);}
  promote(id:string,version:number,approval:HimCalibrationApproval):HimCalculationModel {
    const model=this.get(id,version); if(!model)throw new BadRequestException('Unknown calculation model.');
    if(model.environment!=='PRODUCTION'||model.lifecycle!=='VALIDATED')throw new BadRequestException('Model is not eligible for calibration promotion.');
    if(approval.modelId!==id||approval.modelVersion!==version||!approval.authorityId||!approval.canonicalSource)throw new BadRequestException('Invalid protected calibration approval.');
    const promoted=Object.freeze({...model,lifecycle:'CALIBRATED' as const}); this.models.set(`${id}@${version}`,promoted); return promoted;
  }
  private validate(m:HimCalculationModel):void {
    if(!ID.test(bounded(m.modelId,128,'modelId'))||!Number.isSafeInteger(m.modelVersion)||m.modelVersion<1)throw new BadRequestException('Invalid calculation model identity/version.');
    if(!ID.test(bounded(m.targetMetricKey,128,'targetMetricKey'))||!Number.isSafeInteger(m.targetDefinitionVersion)||m.targetDefinitionVersion<1)throw new BadRequestException('Invalid target identity/version.');
    if(!HIM_MODEL_LIFECYCLES.includes(m.lifecycle)||!HIM_MODEL_ENVIRONMENTS.includes(m.environment))throw new BadRequestException('Invalid model lifecycle/environment.');
    ['canonicalOwner','canonicalSource','methodType','scaleContractReference','requiredEvidenceContract','implementationId'].forEach(f=>bounded(m[f as keyof HimCalculationModel],256,f));
    if(!Array.isArray(m.requiredInputKeys)||m.requiredInputKeys.length>32||new Set(m.requiredInputKeys).size!==m.requiredInputKeys.length)throw new BadRequestException('Invalid required input contract.');
    m.requiredInputKeys.forEach(x=>bounded(x,128,'requiredInputKeys'));
    if(!Array.isArray(m.supportedContextKinds)||!m.supportedContextKinds.length||new Set(m.supportedContextKinds).size!==m.supportedContextKinds.length||m.supportedContextKinds.some(k=>!HIM_CONTEXT_KINDS.includes(k)))throw new BadRequestException('Invalid supported contexts.');
    if(!HIM_MISSING_BEHAVIORS.includes(m.missingDataBehavior)||!HIM_CONTRADICTION_BEHAVIORS.includes(m.contradictionBehavior)||!HIM_CONFIDENCE_CONTRACTS.includes(m.confidenceContract))throw new BadRequestException('Invalid fail-closed model contracts.');
    if(!Number.isFinite(Date.parse(m.createdAt))||!Number.isFinite(Date.parse(m.versionedAt)))throw new BadRequestException('Invalid model timestamps.');
  }
}

