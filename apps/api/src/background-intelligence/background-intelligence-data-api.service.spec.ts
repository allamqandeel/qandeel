import { BackgroundIntelligenceAuthorityService, BackgroundIntelligenceExecutionContext, type BackgroundIntelligenceExecutionContext as ExecutionContext } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory, BackgroundIntelligenceEventContext } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService, type BackgroundConversationSessionState, type BackgroundConversationTurnState } from './background-intelligence-data-api.service';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const IDS={event:'10000000-0000-4000-8000-000000000001',user:'10000000-0000-4000-8000-000000000002',session:'10000000-0000-4000-8000-000000000003',turn:'10000000-0000-4000-8000-000000000004'};
const event:RuntimeEventEnvelope={event_id:IDS.event,event_type:'ConversationTurnCompleted',event_version:'2.0',occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:IDS.user,subject_session_id:IDS.session,subject_turn_id:IDS.turn,correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:'qandeel.runtime.conversation-turn-completed.v2',payload:{user_id:IDS.user,session_id:IDS.session,source_turn_id:IDS.turn,terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,safety_disposition:'ALLOW'},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1'};
const factory=new BackgroundIntelligenceContextFactory(),ownership=factory.create(event) as BackgroundIntelligenceEventContext;
const session:BackgroundConversationSessionState={id:IDS.session,status:'ACTIVE',channel:'TEXT'},source:BackgroundConversationTurnState={id:IDS.turn,session_id:IDS.session,role:'USER',status:'COMPLETED',source_turn_id:null},assistant:BackgroundConversationTurnState={id:'10000000-0000-4000-8000-000000000005',session_id:IDS.session,role:'ASSISTANT',status:'COMPLETED',source_turn_id:IDS.turn};
async function authorize():Promise<ExecutionContext>{const dataApi={findSession:jest.fn().mockResolvedValue(session),findSourceTurn:jest.fn().mockResolvedValue(source),findCompletedAssistant:jest.fn().mockResolvedValue(assistant)}as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>,result=await new BackgroundIntelligenceAuthorityService(factory,dataApi).authorize(event);if(result.outcome!=='AUTHORIZED'||!result.context)throw new Error('test authority issuance failed');return result.context;}

describe('BackgroundIntelligenceDataApiService',()=>{
 const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 beforeEach(()=>{process.env.SUPABASE_URL='https://database.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='SENTINEL_SERVICE_ROLE';jest.spyOn(global,'fetch').mockResolvedValue({ok:true,status:200,json:async()=>[]}as Response);});
 afterEach(()=>{jest.restoreAllMocks();if(saved.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=saved.url;if(saved.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=saved.key;});
 it('accepts the validated event context only for explicitly scoped ownership reads',async()=>{const service=new BackgroundIntelligenceDataApiService();await service.findSession(ownership);await service.findSourceTurn(ownership);await service.findCompletedAssistant(ownership);for(const[url]of(fetch as jest.Mock).mock.calls)expect(new URL(url).searchParams.get('user_id')).toBe(`eq.${ownership.userId}`);expect(new URL((fetch as jest.Mock).mock.calls[1][0]).searchParams.get('session_id')).toBe(`eq.${ownership.sessionId}`);expect(new URL((fetch as jest.Mock).mock.calls[1][0]).searchParams.get('id')).toBe(`eq.${ownership.sourceTurnId}`);expect(new URL((fetch as jest.Mock).mock.calls[2][0]).searchParams.get('source_turn_id')).toBe(`eq.${ownership.sourceTurnId}`);});
 it('MEM-AR-01C: records the Memory through the ONE guarded writer, named by the source turn, never by the owner',async()=>{const memoryId='20000000-0000-4000-8000-000000000001';(fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[{outcome:'CREATED',memory_id:memoryId}]}as Response);const service=new BackgroundIntelligenceDataApiService(),context=await authorize();const recorded=await service.recordMemory(context,{id:memoryId,type:'GOAL',content:'private',source:'USER_STATED',confidence:1,importance:1,status:'ACTIVE',user_id:'user-b'}as never);expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://database.invalid/rest/v1/rpc/background_record_memory_v1');const body=JSON.parse(((fetch as jest.Mock).mock.calls[0][1]as RequestInit).body as string);expect(body).toEqual({p_source_turn_id:context.sourceTurnId,p_memory_id:memoryId,p_type:'GOAL',p_content:'private',p_confidence:1,p_importance:1,p_expires_at:null});
  // The owner, source, status, scope, version and lineage are the database's; the caller cannot supply them.
  for(const forbidden of ['p_user_id','user_id','p_source','p_status','scope','p_scope','p_version','p_created_at','p_updated_at','p_supersedes_memory_id'])expect(body).not.toHaveProperty(forbidden);
  // The canonical Memory UUID round-trips unchanged so `memory:<uuid>` stays exact.
  expect(recorded).toEqual({outcome:'CREATED',memoryId});});
 it('MEM-AR-01C: maps every background_record_memory_v1 answer and fails closed on anything else',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize(),input={id:'20000000-0000-4000-8000-000000000001',type:'GOAL',content:'x',source:'USER_STATED',confidence:1,importance:1,status:'ACTIVE'}as never;const answer=(rows:unknown)=>(fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>rows}as Response);
  answer([{outcome:'ALREADY_RECORDED',memory_id:'20000000-0000-4000-8000-000000000009'}]);await expect(service.recordMemory(context,input)).resolves.toEqual({outcome:'ALREADY_RECORDED',memoryId:'20000000-0000-4000-8000-000000000009'});
  for(const outcome of ['SKIPPED_COMMAND_TURN','EQUIVALENT_EXISTS','SUPERSEDED_BY_LATER_COMMAND']){answer([{outcome,memory_id:null}]);await expect(service.recordMemory(context,input)).resolves.toEqual({outcome});}
  for(const rows of [[],[{outcome:'CREATED',memory_id:'20000000-0000-4000-8000-000000000002'}],[{outcome:'CREATED',memory_id:null}],[{outcome:'EQUIVALENT_EXISTS',memory_id:'20000000-0000-4000-8000-000000000001'}],[{outcome:'WRITTEN',memory_id:null}],[{outcome:'CREATED',memory_id:'20000000-0000-4000-8000-000000000001'},{outcome:'CREATED',memory_id:'20000000-0000-4000-8000-000000000001'}]]){answer(rows);await expect(service.recordMemory(context,input)).rejects.toThrow('BACKGROUND_MEMORY_RECORD_INTEGRITY');}});
 it('MEM-AR-01C: every Memory read embeds the subject and resolves it, fail-safe to UNATTRIBUTED',async()=>{(fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[{id:'a',memory_subject_attributions:{subject:'SELF'}},{id:'b',memory_subject_attributions:null}]}as Response);const service=new BackgroundIntelligenceDataApiService(),context=await authorize();const rows=await service.listActiveMemories(context,32);expect(new URL((fetch as jest.Mock).mock.calls[0][0]).searchParams.get('select')).toMatch(/,memory_subject_attributions\(subject\),memory_typed_confirmations\(memory_id\)$/u);expect(rows.map(row=>row.subject)).toEqual(['SELF',null]);}); // RE-ANCHORED by S8B-03 (CP1, E5): typed confirmations embedded
 it('owner-scopes every execution read and uses minimal explicit-user RPC inputs',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize();await service.readCanonicalSourceTurn(context);await service.listActiveMemories(context,32);await service.listActiveHypotheses(context,32);await service.findHypothesis(context,'hypothesis-a');for(const[url]of(fetch as jest.Mock).mock.calls)expect(new URL(url).searchParams.get('user_id')).toBe(`eq.${context.userId}`);(fetch as jest.Mock).mockClear();await service.createConfidenceEvaluation(context,'evaluation-a','hypothesis-a',3);const body=JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);expect(body).toEqual({p_user_id:context.userId,p_evaluation_id:'evaluation-a',p_hypothesis_id:'hypothesis-a',p_target_version:3});expect(body).not.toHaveProperty('accessToken');});
 it('routes the server-authorized Hypothesis Update through the background wrapper and derives identity from the context',async()=>{
  const mutation={update:{id:'update-a'},hypothesis:{id:'hypothesis-a'}};
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[mutation]}as Response);
  const service=new BackgroundIntelligenceDataApiService(),context=await authorize();
  const request={hypothesisId:'hypothesis-a',expectedVersion:3,evidenceId:'memory:20000000-0000-4000-8000-000000000001',evidenceRole:'SUPPORTING' as const};
  await expect(service.applyHypothesisUpdate(context,'update-a',request)).resolves.toEqual(mutation);
  expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://database.invalid/rest/v1/rpc/background_apply_hypothesis_evidence_update_v1');
  const body=JSON.parse(((fetch as jest.Mock).mock.calls[0][1]as RequestInit).body as string);
  // Owner and session come from the issued context alone; there is no access
  // token, user JWT, or caller-selected identity on this path.
  expect(body).toEqual({p_user_id:context.userId,p_session_id:context.sessionId,p_update_id:'update-a',p_hypothesis_id:'hypothesis-a',p_expected_version:3,p_evidence_id:'memory:20000000-0000-4000-8000-000000000001',p_evidence_role:'SUPPORTING'});
  for(const forbidden of['accessToken','token','jwt','p_access_token','p_jwt','Authorization'])expect(body).not.toHaveProperty(forbidden);
  const headers=((fetch as jest.Mock).mock.calls[0][1]as RequestInit).headers as Record<string,string>;
  expect(headers.Authorization).toBe('Bearer SENTINEL_SERVICE_ROLE');});
 it('rejects pre-authorization, spread, and prototype-forged contexts for the Hypothesis Update wrapper before network I/O',async()=>{
  const service=new BackgroundIntelligenceDataApiService(),authorized=await authorize();
  const request={hypothesisId:'hypothesis-a',expectedVersion:3,evidenceId:'memory:20000000-0000-4000-8000-000000000001',evidenceRole:'SUPPORTING' as const};
  for(const forged of[ownership,{...authorized},Object.create(BackgroundIntelligenceExecutionContext.prototype)])
   await expect(service.applyHypothesisUpdate(forged as ExecutionContext,'update-a',request)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
  expect(fetch).not.toHaveBeenCalled();});
 it('rejects pre-authorization context, spread copies, and prototype forgeries for writes',async()=>{const service=new BackgroundIntelligenceDataApiService(),authorized=await authorize();for(const forged of [ownership,{...authorized},Object.create(BackgroundIntelligenceExecutionContext.prototype)])await expect(service.recordMemory(forged as ExecutionContext,{ }as never)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');expect(fetch).not.toHaveBeenCalled();});
 it('rejects spread copies and prototype forgeries for ownership reads',async()=>{const service=new BackgroundIntelligenceDataApiService();for(const forged of [{...ownership},Object.create(BackgroundIntelligenceEventContext.prototype)])await expect(service.findSession(forged as BackgroundIntelligenceEventContext)).rejects.toThrow('BACKGROUND_INTELLIGENCE_EVENT_CONTEXT_REQUIRED');expect(fetch).not.toHaveBeenCalled();});
 it('routes the background HIM read only through the session-only snapshot wrapper with exact context identity',async()=>{
  const service=new BackgroundIntelligenceDataApiService(),context=await authorize();
  await service.readHimConversationSnapshot(context);
  expect(fetch).toHaveBeenCalledTimes(1);
  // The ONE allowed path: the CONVERSATION_SESSION-only service-role RPC. No
  // direct HIM table/view read exists on this boundary.
  expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://database.invalid/rest/v1/rpc/background_read_him_conversation_snapshot_v1');
  const[, init]=(fetch as jest.Mock).mock.calls[0]as[string,RequestInit];
  expect(init.method).toBe('POST');
  const body=JSON.parse(init.body as string);
  // Exact user/session binding from the issued execution context alone.
  expect(body).toEqual({p_user_id:context.userId,p_session_id:context.sessionId});
  // No user bearer token, fake JWT, request claims, or context selection input.
  for(const forbidden of['accessToken','token','jwt','claims','p_access_token','p_jwt','p_claims','Authorization','p_context_kind','p_context_id'])expect(body).not.toHaveProperty(forbidden);
  const headers=init.headers as Record<string,string>;
  expect(headers.Authorization).toBe('Bearer SENTINEL_SERVICE_ROLE');
 });
 it('rejects pre-authorization, spread, and prototype-forged contexts for the HIM read before network I/O',async()=>{
  const service=new BackgroundIntelligenceDataApiService(),authorized=await authorize();
  for(const forged of[ownership,{...authorized},Object.create(BackgroundIntelligenceExecutionContext.prototype)])
   await expect(service.readHimConversationSnapshot(forged as ExecutionContext)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('keeps service-role credentials internal and failures sanitized',async()=>{const service=new BackgroundIntelligenceDataApiService();(fetch as jest.Mock).mockRejectedValueOnce(new Error('raw secret'));await expect(service.findSession(ownership)).rejects.toThrow('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');expect(JSON.stringify(ownership)).not.toContain('SENTINEL_SERVICE_ROLE');});

 // INTEL-TM-01: both server reads send only the authority-issued owner, never a credential or a client value.
 it('INTEL-TM-01 sends the reliance read and the housekeeping with the execution owner only',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize();
  await service.readHypothesisEvidenceReliance(context,['h-1','h-2']);(fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>3}as Response);
  await expect(service.reevaluateWithdrawnHypothesisEvidence(context,32)).resolves.toBe(3);
  const [[relianceUrl,relianceInit],[housekeepingUrl,housekeepingInit]]=(fetch as jest.Mock).mock.calls;
  expect(new URL(relianceUrl).pathname).toMatch(/\/rpc\/background_hypothesis_evidence_reliance_v1$/u);expect(JSON.parse(relianceInit.body)).toEqual({p_user_id:context.userId,p_hypothesis_ids:['h-1','h-2']});
  expect(new URL(housekeepingUrl).pathname).toMatch(/\/rpc\/background_reevaluate_withdrawn_hypothesis_evidence_v1$/u);expect(JSON.parse(housekeepingInit.body)).toEqual({p_user_id:context.userId,p_limit:32});
  await expect(service.readHypothesisEvidenceReliance({...context},['h-1'])).rejects.toThrow();});
 it('S8A-03 CP2: reads the bounded unindexed backlog through the execution-scoped definer and fails closed on a malformed row',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize(),m='20000000-0000-4000-8000-000000000001';
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[{memory_id:m,type:'GOAL',content:'عايز أتعلم ألماني.'}]}as Response);
  await expect(service.listUnindexedMemories(context,4)).resolves.toEqual([{memoryId:m,type:'GOAL',content:'عايز أتعلم ألماني.'}]);
  const[url,init]=(fetch as jest.Mock).mock.calls[0];expect(url).toBe('https://database.invalid/rest/v1/rpc/background_unindexed_memories_v1');
  expect(JSON.parse(init.body)).toEqual({p_source_turn_id:context.sourceTurnId,p_limit:4});
  for(const rows of [[{memory_id:'x',type:'GOAL',content:'c'}],[{memory_id:m,type:'SECRET',content:'c'}],[{memory_id:m,type:'GOAL',content:1}],{},Array(5).fill({memory_id:m,type:'GOAL',content:'c'})]){
   (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>rows}as Response);
   await expect(service.listUnindexedMemories(context,4)).rejects.toThrow('BACKGROUND_UNDERSTANDING_BACKFILL_INTEGRITY');}});
 it('S8A-03 Open Understanding: reads what QANDEEL knows through the execution-scoped definer, with person labels, and fails closed on a malformed row',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize(),m='20000000-0000-4000-8000-000000000001';
  // RE-ANCHORED by S8B-03 (CP1, E5): v2 of the read adds the source and the typed confirmation of each item.
  const good={memory_id:m,type:'PERSONAL_FACT',content:'سلمى بقت مدرسة.',subject:'OTHER',person_name:'سلمى',person_relation:'مراتي',temporal:'CURRENT',ended:false,terms:['مدرس'],source:'MACHINE_ASR',confirmed_by_typing:true};
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[good]}as Response);
  await expect(service.listKnownMemories(context,40)).resolves.toEqual([{memoryId:m,type:'PERSONAL_FACT',content:'سلمى بقت مدرسة.',subject:'OTHER',personName:'سلمى',personRelation:'مراتي',temporal:'CURRENT',ended:false,terms:['مدرس'],source:'MACHINE_ASR',confirmedByTyping:true}]);
  const[url,init]=(fetch as jest.Mock).mock.calls[0];expect(url).toBe('https://database.invalid/rest/v1/rpc/background_known_memories_v2');
  // The source turn names the RUNNING execution; the owner is the database's, never the caller's.
  expect(JSON.parse((init as RequestInit).body as string)).toEqual({p_source_turn_id:context.sourceTurnId,p_limit:40});
  for(const rows of [[{...good,memory_id:'x'}],[{...good,subject:'ME'}],[{...good,person_name:3}],[{...good,ended:'no'}],[{...good,terms:[1]}],[{...good,type:'SECRET'}],[{...good,source:'SPOKEN'}],[{...good,confirmed_by_typing:'yes'}],Array(41).fill(good),{}]){
   (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>rows}as Response);
   await expect(service.listKnownMemories(context,40)).rejects.toThrow('BACKGROUND_UNDERSTANDING_KNOWN_INTEGRITY');}});
 it('S8A-03 Open Understanding: reads only the completed turns of the same Session BEFORE the source turn, oldest first, owner-scoped',async()=>{const service=new BackgroundIntelligenceDataApiService(),context=await authorize();
  const later={id:'30000000-0000-4000-8000-000000000009',role:'USER',content:'بعدها'};
  const rows=[later,{id:context.sourceTurnId,role:'USER',content:'الرسالة نفسها'},{id:'30000000-0000-4000-8000-000000000003',role:'ASSISTANT',content:'رد قنديل'},
   {id:'30000000-0000-4000-8000-000000000002',role:'USER',content:'مراتي سلمى'},{id:'30000000-0000-4000-8000-000000000001',role:'USER',content:'أقدم'}];
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>rows}as Response);
  await expect(service.listRecentTurns(context,2)).resolves.toEqual([{role:'USER',content:'مراتي سلمى'},{role:'ASSISTANT',content:'رد قنديل'}]);
  const params=new URL((fetch as jest.Mock).mock.calls[0][0]).searchParams;
  expect([params.get('user_id'),params.get('session_id'),params.get('status')]).toEqual([`eq.${context.userId}`,`eq.${context.sessionId}`,'eq.COMPLETED']);
  // The source turn not found in the window: nothing is sent rather than a guess.
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>[later]}as Response);
  await expect(service.listRecentTurns(context,2)).resolves.toEqual([]);
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,status:200,json:async()=>({})}as Response);
  await expect(service.listRecentTurns(context,2)).rejects.toThrow('BACKGROUND_UNDERSTANDING_TURNS_INTEGRITY');});
});
