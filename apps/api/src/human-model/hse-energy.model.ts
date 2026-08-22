import { BadRequestException } from '@nestjs/common';
import type { HimCalculationModel, HimMetricCalculationInput, HimMetricCalculationResult } from './him-calculation.types';

export const HSE_ENERGY_MODEL_ID = 'hse.energy.direct-structured-user-report';
export const HSE_ENERGY_MODEL_VERSION = 1;
export const HSE_ENERGY_INSTRUMENT_ID = 'hse.energy.ar-eg.right-now';
export const HSE_ENERGY_INSTRUMENT_VERSION = 1;
export const HSE_ENERGY_SCALE_REFERENCE = 'hse.energy.ordinal-5.v1';
export const HSE_ENERGY_SCALE_VERSION = 1;
export const HSE_ENERGY_BINDING_VERSION = 1;
export const HSE_ENERGY_RESPONSES = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'NOT_SURE'] as const;
export type HseEnergyResponse = (typeof HSE_ENERGY_RESPONSES)[number];

export interface HseEnergyMeasurementObservationInput {
  observationId: string; measurementEventId: string; userId: string; metricKey: 'hse.energy'; definitionVersion: 1;
  contextKind: 'CONVERSATION_SESSION'; contextId: string; instrumentId: typeof HSE_ENERGY_INSTRUMENT_ID;
  instrumentVersion: 1; scaleContractReference: typeof HSE_ENERGY_SCALE_REFERENCE; scaleVersion: 1;
  responseCode: HseEnergyResponse; reportTimestamp: string; locale: 'ar-EG';
  source: 'DIRECT_STRUCTURED_USER_REPORT'; superseded: boolean;
}

export const HSE_ENERGY_MODEL: HimCalculationModel = Object.freeze<HimCalculationModel>({
  modelId: HSE_ENERGY_MODEL_ID, modelVersion: HSE_ENERGY_MODEL_VERSION, targetMetricKey: 'hse.energy', targetDefinitionVersion: 1,
  lifecycle: 'CALIBRATED', environment: 'PRODUCTION', canonicalOwner: 'QANDEEL_HIM_GOVERNANCE',
  canonicalSource: 'ISSUE_56_HSE_ENERGY_MEASUREMENT_MODEL_V1', methodType: 'DIRECT_STRUCTURED_USER_REPORT',
  scaleContractReference: HSE_ENERGY_SCALE_REFERENCE, requiredInputKeys: ['observation'],
  requiredEvidenceContract: 'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1', supportedContextKinds: ['CONVERSATION_SESSION'],
  missingDataBehavior: 'UNASSESSED', contradictionBehavior: 'UNASSESSED_PRESERVE_CONFLICT',
  confidenceContract: 'UNRESOLVED_METRIC_CONFIDENCE', implementationId: 'hse-energy-direct-structured-v1',
  createdAt: '2026-08-22T00:00:00.000Z', versionedAt: '2026-08-22T00:00:00.000Z',
});

const SCORES: Readonly<Record<Exclude<HseEnergyResponse, 'NOT_SURE'>, number>> = Object.freeze({VERY_LOW:1,LOW:2,MODERATE:3,HIGH:4,VERY_HIGH:5});

export function calculateHseEnergy(input:HimMetricCalculationInput):HimMetricCalculationResult {
  const observation=input.inputs.observation as HseEnergyMeasurementObservationInput|undefined;
  const base={metricKey:input.metricKey,definitionVersion:input.definitionVersion,modelId:input.modelId,modelVersion:input.modelVersion,context:{...input.context},missingInputKeys:observation?[]:['observation'],supportingEvidenceRefs:[...input.supportingEvidenceRefs],contradictoryEvidenceRefs:[...input.contradictoryEvidenceRefs],calculatedAt:new Date().toISOString(),provenance:input.provenance,confidenceState:'UNASSESSED' as const,confidenceReference:null,traceId:input.traceId,updateReason:input.updateReason};
  if(!observation)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
  if(input.context.kind!=='CONVERSATION_SESSION'||observation.contextKind!==input.context.kind||observation.contextId!==input.context.id)throw new BadRequestException('Energy observation exact context mismatch.');
  if(observation.metricKey!=='hse.energy'||observation.definitionVersion!==1||observation.instrumentId!==HSE_ENERGY_INSTRUMENT_ID||observation.instrumentVersion!==1||observation.scaleContractReference!==HSE_ENERGY_SCALE_REFERENCE||observation.scaleVersion!==1||observation.locale!=='ar-EG'||observation.source!=='DIRECT_STRUCTURED_USER_REPORT'||!Number.isFinite(Date.parse(observation.reportTimestamp))||!HSE_ENERGY_RESPONSES.includes(observation.responseCode))throw new BadRequestException('Energy observation contract mismatch.');
  if(observation.superseded)throw new BadRequestException('Superseded Energy observation cannot be calculated.');
  if(input.contradictoryEvidenceRefs.length)return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'PRESENT_UNRESOLVED'};
  if(observation.responseCode==='NOT_SURE')return{...base,resultState:'UNASSESSED',numericValue:null,contradictionState:'NONE'};
  return{...base,resultState:'ASSESSED',numericValue:SCORES[observation.responseCode],contradictionState:'NONE'};
}

