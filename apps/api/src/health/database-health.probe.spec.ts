import { DATABASE_READINESS_REUSE_MS,DATABASE_READINESS_RPC,DatabaseHealthProbe,databaseHealthTimeoutMs } from './database-health.probe';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { HealthProbe } from './health.types';

const answer=(status:number,body:string)=>({status,ok:status>=200&&status<300,text:jest.fn().mockResolvedValue(body)}as unknown as Response);
const configure=()=>{process.env.SUPABASE_URL='https://SENTINEL_DB_ENDPOINT/';process.env.SUPABASE_SERVICE_ROLE_KEY='SENTINEL_SERVER_KEY';};

describe('DatabaseHealthProbe (PROD-OPS-01)',()=>{const saved={...process.env};afterEach(()=>{process.env={...saved};jest.restoreAllMocks();});
 it('is distinctly not configured and performs no network without the canonical server channel',async()=>{const request=jest.spyOn(global,'fetch');
  for(const [url,key] of [[undefined,'k'],['https://x',undefined],[undefined,undefined]] as const){if(url)process.env.SUPABASE_URL=url;else delete process.env.SUPABASE_URL;if(key)process.env.SUPABASE_SERVICE_ROLE_KEY=key;else delete process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_PUBLISHABLE_KEY='a-publishable-key-is-not-enough';await expect(new DatabaseHealthProbe().check()).resolves.toBe('not_configured');}
  expect(request).not.toHaveBeenCalled();});
 it('calls exactly the zero-parameter readiness RPC with the server credential, never the Data API root',async()=>{configure();process.env.SUPABASE_PUBLISHABLE_KEY='SENTINEL_PUBLISHABLE_KEY';const request=jest.spyOn(global,'fetch').mockResolvedValue(answer(200,'true'));
  await expect(new DatabaseHealthProbe().check()).resolves.toBe('available');
  expect(DATABASE_READINESS_RPC).toBe('server_database_ready_v1');
  expect(request).toHaveBeenCalledTimes(1);
  const [url,init]=request.mock.calls[0] as [string,RequestInit];
  expect(url).toBe('https://SENTINEL_DB_ENDPOINT/rest/v1/rpc/server_database_ready_v1');
  expect(url).not.toMatch(/\/rest\/v1\/?$/u);
  expect(init).toEqual(expect.objectContaining({method:'POST',body:'{}',signal:expect.any(AbortSignal),headers:{apikey:'SENTINEL_SERVER_KEY',Authorization:'Bearer SENTINEL_SERVER_KEY','Content-Type':'application/json',Accept:'application/json'}}));
  expect(JSON.stringify(init)).not.toMatch(/SENTINEL_PUBLISHABLE_KEY|runtime_event_outbox|user|session/iu);});
 it('is available ONLY for the exact successful answer; every other status or shape is unavailable',async()=>{configure();
  for(const ok of ['true','true\n',' true ']){jest.spyOn(global,'fetch').mockResolvedValueOnce(answer(200,ok));await expect(new DatabaseHealthProbe().check()).resolves.toBe('available');}
  for(const [status,body] of [[200,'false'],[200,'null'],[200,'[]'],[200,'{"ready":true}'],[200,'"true"'],[200,''],[200,`true${' '.repeat(40)}`],[201,'true'],[204,''],[300,'true'],[401,'{"message":"RAW_UPSTREAM_SECRET"}'],[403,'{}'],[404,'{"code":"PGRST202"}'],[500,'true'],[503,'true']] as const){
   jest.spyOn(global,'fetch').mockResolvedValueOnce(answer(status,body));const result=await new DatabaseHealthProbe().check();expect(result).toBe('unavailable');expect(String(result)).not.toMatch(/RAW_UPSTREAM_SECRET/u);}});
 it('maps transport failures to a finite unavailable state and never leaks them',async()=>{configure();jest.spyOn(global,'fetch').mockRejectedValue(new TypeError('fetch failed RAW_DATABASE_SECRET'));await expect(new DatabaseHealthProbe().check()).resolves.toBe('unavailable');
  jest.spyOn(global,'fetch').mockResolvedValue({status:200,text:jest.fn().mockRejectedValue(new Error('RAW_BODY_SECRET'))}as unknown as Response);await expect(new DatabaseHealthProbe().check()).resolves.toBe('unavailable');});
 it('actually aborts a hanging request at the bounded timeout without network',async()=>{configure();process.env.HEALTH_DATABASE_TIMEOUT_MS='100';jest.spyOn(global,'fetch').mockImplementation((_input,init)=>new Promise((_resolve,reject)=>{const signal=init?.signal as AbortSignal;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}));const started=Date.now();await expect(new DatabaseHealthProbe().check()).resolves.toBe('timeout');expect(Date.now()-started).toBeGreaterThanOrEqual(75);expect(Date.now()-started).toBeLessThan(1000);});
 it('reads a real streamed answer, and stops reading an oversized one past the bound',async()=>{configure();
  jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response('true',{status:200}));await expect(new DatabaseHealthProbe().check()).resolves.toBe('available');
  let pulled=0;const huge=new ReadableStream<Uint8Array>({pull(controller){pulled+=1;controller.enqueue(new TextEncoder().encode('t'.repeat(1024)));if(pulled>1000)controller.close();}});
  jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response(huge,{status:200}));await expect(new DatabaseHealthProbe().check()).resolves.toBe('unavailable');expect(pulled).toBeLessThan(5);});
 it('coalesces concurrent checks into one request and reuses a result for one second only (no database amplification)',async()=>{configure();jest.useFakeTimers({doNotFake:['nextTick','setImmediate','queueMicrotask']});try{
  const request=jest.spyOn(global,'fetch').mockResolvedValue(answer(200,'true'));const probe=new DatabaseHealthProbe();
  await expect(Promise.all(Array.from({length:50},()=>probe.check()))).resolves.toEqual(Array(50).fill('available'));expect(request).toHaveBeenCalledTimes(1);
  await probe.check();expect(request).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(DATABASE_READINESS_REUSE_MS);request.mockResolvedValue(answer(500,'{}'));
  await expect(probe.check()).resolves.toBe('unavailable');expect(request).toHaveBeenCalledTimes(2);}finally{jest.useRealTimers();}});
 it('clamps external probe timeouts to a strict 100–5000 ms boundary',()=>{expect(databaseHealthTimeoutMs({})).toBe(1500);expect(databaseHealthTimeoutMs({HEALTH_DATABASE_TIMEOUT_MS:'1'})).toBe(100);expect(databaseHealthTimeoutMs({HEALTH_DATABASE_TIMEOUT_MS:'99999'})).toBe(5000);expect(databaseHealthTimeoutMs({HEALTH_DATABASE_TIMEOUT_MS:'invalid'})).toBe(1500);});
});

describe('/health/ready through the real database probe (PROD-OPS-01)',()=>{const saved={...process.env};afterEach(()=>{process.env={...saved};jest.restoreAllMocks();});
 const fixed=(status:string):HealthProbe=>({check:jest.fn().mockResolvedValue(status)}as HealthProbe);
 async function ready(observability:HealthProbe=fixed('configured')){const response={status:jest.fn()};const body=await new HealthController(new HealthService(new DatabaseHealthProbe(),fixed('configured')as never,fixed('not_configured')as never,observability as never)).getReady(response);return{code:response.status.mock.calls[0][0],body};}
 it('is HTTP 200 when the readiness RPC answers and the other required dependency is configured',async()=>{configure();jest.spyOn(global,'fetch').mockResolvedValue(answer(200,'true'));const{code,body}=await ready();expect(code).toBe(200);expect(body).toEqual({status:'ready',service:'qandeel-api',dependencies:{database:{requirement:'required',status:'available'},model_provider:{requirement:'required',status:'configured'},runtime_events:{requirement:'optional',status:'not_configured'},observability:{requirement:'optional',status:'configured'}}});});
 it('is HTTP 503 when the readiness RPC genuinely fails, with no upstream body, secret or endpoint in the answer',async()=>{configure();jest.spyOn(global,'fetch').mockResolvedValue(answer(500,'{"message":"RAW_UPSTREAM_SECRET"}'));const{code,body}=await ready();expect(code).toBe(503);expect(body.status).toBe('not_ready');expect(body.dependencies.database).toEqual({requirement:'required',status:'unavailable'});expect(JSON.stringify(body)).not.toMatch(/RAW_UPSTREAM_SECRET|SENTINEL|rest\/v1|rpc|server_database_ready/u);});
 it('an optional telemetry / observability failure never changes API readiness',async()=>{configure();jest.spyOn(global,'fetch').mockResolvedValue(answer(200,'true'));const{code,body}=await ready({check:jest.fn().mockRejectedValue(new Error('OTEL_EXPORTER_DOWN'))}as HealthProbe);expect(code).toBe(200);expect(body.status).toBe('ready');expect(body.dependencies.observability).toEqual({requirement:'optional',status:'degraded'});});
 it('privacy / export operational state is no readiness input: readiness composes exactly four fixed probes',()=>{expect(HealthService.length).toBe(4);expect(Object.keys(new HealthService(fixed('available')as never,fixed('configured')as never,fixed('x')as never,fixed('x')as never)).sort()).toEqual(['database','modelProvider','observability','runtimeEvents']);});
});
