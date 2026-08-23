import { HealthController } from './health.controller';
import type { HealthService } from './health.service';
describe('HealthController',()=>{
 it('keeps alias and explicit liveness local and dependency-free',()=>{const health={readiness:jest.fn()}as unknown as HealthService,controller=new HealthController(health);expect(controller.getHealth()).toEqual({status:'ok',service:'qandeel-api'});expect(controller.getLive()).toEqual({status:'ok',service:'qandeel-api'});expect(health.readiness).not.toHaveBeenCalled();});
 it.each([['ready',200],['not_ready',503]]as const)('returns bounded readiness body with HTTP semantics for %s',async(status,code)=>{const body={status,service:'qandeel-api',dependencies:{}}as never,health={readiness:jest.fn().mockResolvedValue(body)}as unknown as HealthService,response={status:jest.fn()};await expect(new HealthController(health).getReady(response)).resolves.toBe(body);expect(response.status).toHaveBeenCalledWith(code);});
});
