import{isCompletedRuntimeEventV2,isValidRuntimeEventEnvelope,type RuntimeEventEnvelope}from'./runtime-event.types';const event:RuntimeEventEnvelope={event_id:'10000000-0000-4000-8000-000000000001',event_type:'ConversationTurnCompleted',event_version:'2.0',occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:'10000000-0000-4000-8000-000000000002',subject_session_id:'10000000-0000-4000-8000-000000000003',subject_turn_id:'10000000-0000-4000-8000-000000000004',correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:'qandeel.runtime.conversation-turn-completed.v2',payload:{user_id:'10000000-0000-4000-8000-000000000002',session_id:'10000000-0000-4000-8000-000000000003',source_turn_id:'10000000-0000-4000-8000-000000000004',terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,safety_disposition:'ALLOW'},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1'};
const routed=(processing_path:unknown,routing_reason:unknown):RuntimeEventEnvelope=>({...event,payload:{...event.payload,processing_path,routing_reason}});
describe('Completed runtime event v2',()=>{it.each(['ALLOW','GUIDED','BLOCK']as const)('accepts exact %s disposition',safety=>{const value={...event,payload:{...event.payload,safety_disposition:safety}};expect(isValidRuntimeEventEnvelope(value)).toBe(true);expect(isCompletedRuntimeEventV2(value)).toBe(true);});it('rejects absent, invented, or content-bearing fields',()=>{for(const payload of[{...event.payload,safety_disposition:undefined},{...event.payload,safety_disposition:'UNKNOWN'},{...event.payload,content:'private'}])expect(isValidRuntimeEventEnvelope({...event,payload})).toBe(false);});it('accepts legacy Completed v1 only as a valid envelope, never as v2',()=>{const{ safety_disposition:_,...payload}=event.payload,value={...event,event_version:'1.0'as const,schema_ref:'qandeel.runtime.conversation-turn-completed.v1',payload};expect(isValidRuntimeEventEnvelope(value)).toBe(true);expect(isCompletedRuntimeEventV2(value)).toBe(false);});});

// QIR-002: the routing surface is versioned deliberately. Historical durable and
// pending events keep their pre-QIR-002 pairs and stay valid and recoverable;
// current claims can only produce v2 pairs; unknown reasons and invalid
// FAST/DEEP pairings still fail validation; and the payload SHAPE, event
// version and schema ref are untouched by the routing-reason change.
describe('QIR-002 runtime-event route-pair compatibility',()=>{
 it.each([
  ['FAST','RUNTIME_ROUTING_V2_FAST_DEFAULT'],
  ['DEEP','RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
  ['DEEP','RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
  ['DEEP','RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
  ['DEEP','RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
 ])('accepts the current v2 pair %s + %s',(path,reason)=>{const value=routed(path,reason);expect(isValidRuntimeEventEnvelope(value)).toBe(true);expect(isCompletedRuntimeEventV2(value)).toBe(true);});

 it.each([
  ['FAST','FAST_DEFAULT'],
  ['DEEP','INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
 ])('keeps the historical pair %s + %s valid and recoverable',(path,reason)=>{const value=routed(path,reason);expect(isValidRuntimeEventEnvelope(value)).toBe(true);expect(isCompletedRuntimeEventV2(value)).toBe(true);
  // The same historical pair also stays valid on the Failed v1 envelope that
  // startup recovery replays.
  const{safety_disposition:_,...payload}=value.payload;
  expect(isValidRuntimeEventEnvelope({...value,event_type:'ConversationTurnFailed',event_version:'1.0',schema_ref:'qandeel.runtime.conversation-turn-failed.v1',payload:{...payload,terminal_status:'FAILED'}})).toBe(true);});

 it('accepts the pre-routing null/null state',()=>{expect(isValidRuntimeEventEnvelope(routed(null,null))).toBe(true);});

 it('rejects unknown reasons, cross pairs and half-null states',()=>{
  for(const[path,reason]of[
   ['FAST','INPUT_LENGTH_REQUIRES_DEEP_CONTEXT'],
   ['DEEP','FAST_DEFAULT'],
   ['FAST','RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE'],
   ['FAST','RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION'],
   ['FAST','RUNTIME_ROUTING_V2_DEEP_MULTI_PART'],
   ['FAST','RUNTIME_ROUTING_V2_DEEP_COMPOSITE'],
   ['DEEP','RUNTIME_ROUTING_V2_FAST_DEFAULT'],
   ['FAST','RUNTIME_ROUTING_V3_FAST_DEFAULT'],
   ['DEEP','INVENTED_REASON'],
   ['TURBO','RUNTIME_ROUTING_V2_FAST_DEFAULT'],
   ['fast','RUNTIME_ROUTING_V2_FAST_DEFAULT'],
   ['FAST','runtime_routing_v2_fast_default'],
   ['FAST',null],
   [null,'RUNTIME_ROUTING_V2_FAST_DEFAULT'],
   [null,'FAST_DEFAULT'],
   ['FAST',2],
   [undefined,undefined],
  ]as Array<[unknown,unknown]>)expect(isValidRuntimeEventEnvelope(routed(path,reason))).toBe(false);});

 it('keeps the payload shape, event version and schema ref unchanged for v2 routing',()=>{
  const value=routed('DEEP','RUNTIME_ROUTING_V2_DEEP_MULTI_PART');
  expect(Object.keys(value.payload).sort()).toEqual(['orchestration_id','processing_path','routing_reason','safety_disposition','session_id','source_turn_id','terminal_status','user_id']);
  expect(value.event_version).toBe('2.0');
  expect(value.schema_ref).toBe('qandeel.runtime.conversation-turn-completed.v2');
  expect(value.contains_content).toBe(false);
  // A v2 reason never smuggles content into the event.
  expect(JSON.stringify(value.payload)).not.toMatch(/content|text|message/iu);
  // Adding or removing a payload key is still rejected, so the widened reason
  // vocabulary did not loosen the envelope.
  expect(isValidRuntimeEventEnvelope({...value,payload:{...value.payload,complexity_score:'3'}})).toBe(false);
  const{orchestration_id:_,...missing}=value.payload;
  expect(isValidRuntimeEventEnvelope({...value,payload:missing})).toBe(false);});
});
