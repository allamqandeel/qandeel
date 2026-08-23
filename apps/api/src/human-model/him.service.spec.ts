import { BadRequestException } from '@nestjs/common';
import { HimService } from './him.service';
const user='11111111-1111-4111-8111-111111111111',situation='test-situation';
const base={metricKey:'hse.stress',definitionVersion:1,valueState:'UNASSESSED' as const,contextKind:'SITUATION' as const,contextId:situation,scope:'exact situation',validityStatus:'VALID' as const,descriptiveUpdateReason:'test observation'};
const setup=(status:'UNCALIBRATED'|'CALIBRATED'='UNCALIBRATED')=>{const repository={getDefinition:jest.fn().mockResolvedValue({metricKey:'hse.stress',definitionVersion:1,semanticType:'STATE',calculationStatus:status,validContextKinds:['SITUATION']}),createObservation:jest.fn().mockImplementation(async(_:string,v:object)=>v),getLatest:jest.fn(),listForContext:jest.fn(),history:jest.fn()};return{service:new HimService(repository as never),repository};};
describe('HimService calculation boundary',()=>{
  it('keeps an uncalibrated registered metric UNASSESSED even with evidence',async()=>{const{service}=setup();await expect(service.observe(user,'token',{...base,supportingEvidenceIds:['memory:22222222-2222-4222-8222-222222222222']})).resolves.not.toHaveProperty('numericValue');});
  it('rejects assessed zero and any assessed value for uncalibrated metrics',async()=>{const{service}=setup();await expect(service.observe(user,'token',{...base,valueState:'ASSESSED',numericValue:0})).rejects.toThrow('no approved calibrated');});
  it('preserves structural zero only for a future calibrated definition',async()=>{const{service}=setup('CALIBRATED');await expect(service.observe(user,'token',{...base,valueState:'ASSESSED',numericValue:0})).resolves.toEqual(expect.objectContaining({numericValue:0}));});
  it('does not forward caller-forged calculation or canonical metadata',async()=>{const{service,repository}=setup();await service.observe(user,'token',{...base,calculationStatus:'CALIBRATED',hifOwner:'ABS'} as never);expect(repository.createObservation.mock.calls[0][1]).not.toHaveProperty('calculationStatus');expect(repository.createObservation.mock.calls[0][1]).not.toHaveProperty('hifOwner');});
});
