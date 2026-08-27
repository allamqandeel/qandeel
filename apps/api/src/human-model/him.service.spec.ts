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
describe('HimService canonical latest read',()=>{
  // QHIM-005 / QHIM-007: canonical latest is definition-exact. The service
  // resolves the exact persisted definition, validates context eligibility
  // against it for early contract clarity, and forwards the exact definition
  // version - the database RPC independently re-enforces every rule.
  it('rejects a missing exact definition before any repository latest read',async()=>{
    const{service,repository}=setup();repository.getDefinition.mockResolvedValue(undefined);
    await expect(service.getLatest(user,'token','hse.stress',1,'SITUATION',situation)).rejects.toThrow('definition not found');
    expect(repository.getLatest).not.toHaveBeenCalled();
  });
  it('rejects a context kind outside the exact persisted definition before any repository latest read',async()=>{
    const{service,repository}=setup();
    await expect(service.getLatest(user,'token','hse.stress',1,'GOAL','22222222-2222-4222-8222-222222222222')).rejects.toThrow('does not support this exact context kind');
    expect(repository.getLatest).not.toHaveBeenCalled();
  });
  it('reaches the repository with the exact definition version for an exact valid context',async()=>{
    const{service,repository}=setup();
    await service.getLatest(user,'token','hse.stress',1,'SITUATION',situation);
    expect(repository.getDefinition).toHaveBeenCalledWith('token','hse.stress',1);
    expect(repository.getLatest).toHaveBeenCalledTimes(1);
    expect(repository.getLatest).toHaveBeenCalledWith('token',user,'hse.stress',1,'SITUATION',situation);
  });
  it('forwards a non-v1 definition version exactly instead of defaulting to v1',async()=>{
    const{service,repository}=setup();repository.getDefinition.mockResolvedValue({metricKey:'hse.stress',definitionVersion:4,semanticType:'STATE',calculationStatus:'CALIBRATED',validContextKinds:['SITUATION']});
    await service.getLatest(user,'token','hse.stress',4,'SITUATION',situation);
    expect(repository.getDefinition).toHaveBeenCalledWith('token','hse.stress',4);
    expect(repository.getLatest).toHaveBeenCalledWith('token',user,'hse.stress',4,'SITUATION',situation);
  });
  it('rejects an absent or invalid definition version instead of inserting an implicit default',async()=>{
    const{service,repository}=setup();
    for(const version of [undefined,null,0,-1,1.5,'1'] as never[]){
      await expect(service.getLatest(user,'token','hse.stress',version as never,'SITUATION',situation)).rejects.toThrow(BadRequestException);
    }
    expect(repository.getDefinition).not.toHaveBeenCalled();
    expect(repository.getLatest).not.toHaveBeenCalled();
  });
});

