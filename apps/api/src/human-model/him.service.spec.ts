import { BadRequestException } from '@nestjs/common';
import { HimService } from './him.service';
const user='11111111-1111-4111-8111-111111111111',situation='test-situation';
// QHIM-013: the repository fixture models the final READ-ONLY repository
// surface. The retired generic writer is deliberately absent from it, so no
// test here can re-establish a mocked application write contract that the real
// database rejects.
const setup=(status:'UNCALIBRATED'|'CALIBRATED'='UNCALIBRATED')=>{const repository={getDefinition:jest.fn().mockResolvedValue({metricKey:'hse.stress',definitionVersion:1,semanticType:'STATE',calculationStatus:status,validContextKinds:['SITUATION']}),getLatest:jest.fn(),listForContext:jest.fn(),history:jest.fn()};return{service:new HimService(repository as never),repository};};
describe('HimService generic write authority retirement',()=>{
  // QHIM-013 regression proof of ABSENCE, not merely of non-use: migration 0051
  // retired the generic snapshot writer to a fail-closed no-write tombstone, so
  // the application must not advertise a generic canonical measurement-write
  // method at all. Reflective access keeps this honest without asking
  // TypeScript for a symbol that no longer exists.
  const surface=()=>new HimService({} as never) as unknown as Record<string,unknown>;
  it('exposes no generic observe writer on the service instance or its prototype',()=>{
    const service=surface();
    expect(service.observe).toBeUndefined();
    expect(typeof service.observe).toBe('undefined');
    expect('observe' in service).toBe(false);
    expect(Object.getOwnPropertyNames(HimService.prototype)).not.toContain('observe');
  });
  it('exposes no other generic measurement-write method under any conventional name',()=>{
    const methods=Object.getOwnPropertyNames(HimService.prototype);
    for(const name of ['observe','observeMetric','createObservation','createMeasurement','createSnapshot','writeSnapshot','submitMeasurement'])expect(methods).not.toContain(name);
    // The legitimate read surface is still present and is what remains.
    for(const name of ['getLatest','listForContext','history'])expect(methods).toContain(name);
  });
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

