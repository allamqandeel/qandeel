import { BadRequestException } from '@nestjs/common';
import { HYPOTHESIS_DOMAINS,HYPOTHESIS_TYPES,MAX_ASSUMPTIONS,MAX_DISCONFIRMING_CONDITIONS,MAX_SCOPE_LENGTH,MAX_STATEMENT_LENGTH,MAX_STRUCTURED_TEXT_LENGTH } from './hypothesis.types';
import { MAX_GENERATION_EVIDENCE_ITEMS,type HypothesisCandidateProposal,type HypothesisCandidateRejectionReason,type HypothesisGenerationInput,type HypothesisGenerationRequest } from './hypothesis-generation.types';

export function normalizeGenerationInput(input:HypothesisGenerationInput):Pick<HypothesisGenerationRequest,'problem'|'domain'|'scope'>{
  if(!HYPOTHESIS_DOMAINS.includes(input.domain))throw new BadRequestException('Invalid hypothesis domain.');
  return{problem:boundedText(input.problem,MAX_STATEMENT_LENGTH),domain:input.domain,scope:boundedText(input.scope,MAX_SCOPE_LENGTH)};
}
export function validateGenerationEvidenceIds(ids:string[]):void{if(!Array.isArray(ids)||ids.length>MAX_GENERATION_EVIDENCE_ITEMS||new Set(ids).size!==ids.length)throw new BadRequestException('Invalid generation evidence set.');}
export function hypothesisCollisionKey(statement:string,scope:string):string{return`${normalize(statement)}\u0000${normalize(scope)}`;}
export function validateHypothesisCandidate(value:HypothesisCandidateProposal,request:HypothesisGenerationRequest,seen:Set<string>,active:Set<string>):HypothesisCandidateRejectionReason|undefined{
 const allowedFields=new Set(['statement','type','domain','scope','supportingEvidenceIds','contradictingEvidenceIds','assumptions','disconfirmingConditions']);
 if(!value||typeof value!=='object'||Object.keys(value).some(key=>!allowedFields.has(key))||!HYPOTHESIS_TYPES.includes(value.type)||value.domain!==request.domain||value.scope!==request.scope||!validText(value.statement,MAX_STATEMENT_LENGTH)||!validList(value.assumptions,MAX_ASSUMPTIONS)||!validList(value.disconfirmingConditions,MAX_DISCONFIRMING_CONDITIONS)||!validIds(value.supportingEvidenceIds)||!validIds(value.contradictingEvidenceIds))return'INVALID_CANDIDATE';
 const allowed=new Set(request.eligibleEvidence.map(item=>item.evidenceId));if([...value.supportingEvidenceIds,...value.contradictingEvidenceIds].some(id=>!allowed.has(id)))return'EVIDENCE_OUTSIDE_REQUEST';if(value.supportingEvidenceIds.some(id=>value.contradictingEvidenceIds.includes(id)))return'EVIDENCE_ROLE_CONFLICT';
 const key=hypothesisCollisionKey(value.statement,value.scope);if(seen.has(key))return'DUPLICATE_IN_BATCH';seen.add(key);if(active.has(key))return'DUPLICATE_ACTIVE_HYPOTHESIS';return undefined;
}
function validIds(values:string[]):boolean{return Array.isArray(values)&&values.length<=MAX_GENERATION_EVIDENCE_ITEMS&&new Set(values).size===values.length&&values.every(value=>typeof value==='string'&&value.length>0);}
function validList(values:string[],max:number):boolean{return Array.isArray(values)&&values.length<=max&&new Set(values).size===values.length&&values.every(value=>validText(value,MAX_STRUCTURED_TEXT_LENGTH));}
function validText(value:string,max:number):boolean{return typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;}
function boundedText(value:string,max:number):string{if(!validText(value,max))throw new BadRequestException('Invalid hypothesis generation request.');return value.trim();}
function normalize(value:string):string{return value.normalize('NFKC').trim().replace(/\s+/gu,' ');}
