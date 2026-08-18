import { BadRequestException, Injectable } from '@nestjs/common';
import { INITIAL_HIM_METRICS } from './initial-him-metrics.catalog';
import { HIM_CALCULATION_STATUSES, HIM_CONTEXT_KINDS, HIM_OWNERS, HIM_SEMANTIC_TYPES, MAX_HIM_DEPENDENCIES, type HimMetricDefinition } from './him.types';
const KEY=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const bounded=(v:unknown,max:number,f:string):string=>{if(typeof v!=='string'||v.trim()!==v||v.length===0||v.length>max)throw new BadRequestException(`Invalid ${f}.`);return v;};
const unique=(v:string[],max:number,f:string):void=>{if(!Array.isArray(v)||v.length>max||new Set(v).size!==v.length)throw new BadRequestException(`Invalid ${f}.`);v.forEach(x=>bounded(x,128,f));};
@Injectable()
export class HimDefinitionRegistry {
  private readonly definitions=new Map<string,HimMetricDefinition>();
  constructor(){INITIAL_HIM_METRICS.forEach(definition=>this.register(definition));}
  register(definition:HimMetricDefinition):void{this.validate(definition);const id=`${definition.metricKey}@${definition.definitionVersion}`;if(this.definitions.has(id))throw new BadRequestException('Duplicate HIM metric identity/version.');this.definitions.set(id,Object.freeze({...definition,validContextKinds:[...definition.validContextKinds],consumers:[...definition.consumers],sourceMetadata:[...definition.sourceMetadata],dependencyIds:[...definition.dependencyIds]}));try{this.validateDependencies();}catch(e){this.definitions.delete(id);throw e;}}
  get(k:string,v:number){return this.definitions.get(`${k}@${v}`);} list(){return [...this.definitions.values()];}
  private validate(d:HimMetricDefinition):void{
    if(!KEY.test(bounded(d.metricKey,128,'metricKey')))throw new BadRequestException('Invalid metricKey.');
    bounded(d.canonicalName,160,'canonicalName');bounded(d.canonicalDefinition,2000,'canonicalDefinition');bounded(d.canonicalSource,256,'canonicalSource');bounded(d.scaleReference,256,'scaleReference');bounded(d.requiredInputContract,1000,'requiredInputContract');bounded(d.confidenceRequirementReference,256,'confidenceRequirementReference');
    if(!Number.isSafeInteger(d.definitionVersion)||d.definitionVersion<1)throw new BadRequestException('Invalid definitionVersion.');
    if(!HIM_OWNERS.includes(d.hifOwner)||!HIM_CALCULATION_STATUSES.includes(d.calculationStatus)||!HIM_SEMANTIC_TYPES.includes(d.semanticType))throw new BadRequestException('Unsupported canonical metadata.');
    if(!Array.isArray(d.validContextKinds)||d.validContextKinds.length===0||new Set(d.validContextKinds).size!==d.validContextKinds.length||d.validContextKinds.some(k=>!HIM_CONTEXT_KINDS.includes(k)))throw new BadRequestException('Invalid validContextKinds.');
    unique(d.consumers,16,'consumers');unique(d.sourceMetadata,16,'sourceMetadata');unique(d.dependencyIds,MAX_HIM_DEPENDENCIES,'dependencyIds');if(d.dependencyIds.includes(d.metricKey))throw new BadRequestException('A HIM metric cannot depend on itself.');
  }
  private validateDependencies():void{const latest=new Map<string,HimMetricDefinition>();for(const d of this.definitions.values())if(!latest.has(d.metricKey)||latest.get(d.metricKey)!.definitionVersion<d.definitionVersion)latest.set(d.metricKey,d);for(const d of latest.values())for(const x of d.dependencyIds)if(!latest.has(x))throw new BadRequestException(`Unresolved HIM dependency: ${x}.`);const visiting=new Set<string>(),visited=new Set<string>();const visit=(k:string):void=>{if(visiting.has(k))throw new BadRequestException('Cyclic HIM dependency.');if(visited.has(k))return;visiting.add(k);latest.get(k)?.dependencyIds.forEach(visit);visiting.delete(k);visited.add(k);};latest.forEach((_,k)=>visit(k));}
}

