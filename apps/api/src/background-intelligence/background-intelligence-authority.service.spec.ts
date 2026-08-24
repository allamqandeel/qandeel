import { BackgroundIntelligenceAuthorityService, BackgroundIntelligenceExecutionContext, isBackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import type { BackgroundIntelligenceDataApiService, BackgroundConversationSessionState, BackgroundConversationTurnState } from './background-intelligence-data-api.service';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const IDS={event:'10000000-0000-4000-8000-000000000001',user:'10000000-0000-4000-8000-000000000002',session:'10000000-0000-4000-8000-000000000003',turn:'10000000-0000-4000-8000-000000000004'};
const event=(overrides:Partial<RuntimeEventEnvelope>={}):RuntimeEventEnvelope=>({event_id:IDS.event,event_type:'ConversationTurnCompleted',event_version:'2.0',occurred_at:'2026-01-01T00:00:00Z',producer:'conversation-service',subject_user_id:IDS.user,subject_session_id:IDS.session,subject_turn_id:IDS.turn,correlation_id:null,causation_id:null,classification:'SENSITIVE',schema_ref:'qandeel.runtime.conversation-turn-completed.v2',payload:{user_id:IDS.user,session_id:IDS.session,source_turn_id:IDS.turn,terminal_status:'COMPLETED',processing_path:'FAST',routing_reason:'FAST_DEFAULT',orchestration_id:null,safety_disposition:'ALLOW'},contains_content:false,retention_class:'OPERATIONAL_EVENT_V1',...overrides});
const session:BackgroundConversationSessionState={id:IDS.session,status:'ACTIVE',channel:'TEXT'};
const turn=(overrides:Partial<BackgroundConversationTurnState>={}):BackgroundConversationTurnState=>({id:IDS.turn,session_id:IDS.session,role:'USER',status:'COMPLETED',source_turn_id:null,...overrides});
const assistant=turn({id:'10000000-0000-4000-8000-000000000005',role:'ASSISTANT',source_turn_id:IDS.turn});

describe('BackgroundIntelligenceAuthorityService',()=>{
 const setup=()=>{const contexts=new BackgroundIntelligenceContextFactory(),dataApi={findSession:jest.fn().mockResolvedValue(session),findSourceTurn:jest.fn().mockResolvedValue(turn()),findCompletedAssistant:jest.fn().mockResolvedValue(assistant)}as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;return{service:new BackgroundIntelligenceAuthorityService(contexts,dataApi),dataApi};};
 it('issues execution authority only after the canonical completed exchange is reread',async()=>{const result=await setup().service.authorize(event());expect(result.outcome).toBe('AUTHORIZED');expect(isBackgroundIntelligenceExecutionContext(result.context)).toBe(true);expect(result.context).toMatchObject({authority:'BACKGROUND_INTELLIGENCE_V1',eventId:IDS.event,userId:IDS.user,sessionId:IDS.session,sourceTurnId:IDS.turn});});
 it('does not let a valid pre-authorization context independently issue execution authority',()=>{const ownership=new BackgroundIntelligenceContextFactory().create(event());expect(ownership).toBeDefined();expect(()=>Reflect.construct(BackgroundIntelligenceExecutionContext as unknown as new(...args:unknown[])=>unknown,[ownership,Symbol('forged issuer')])).toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');expect(isBackgroundIntelligenceExecutionContext(ownership)).toBe(false);});
 it('rejects an invalid event before ownership reads or authority issuance',async()=>{const s=setup(),invalid=event({event_type:'ConversationTurnFailed',schema_ref:'qandeel.runtime.conversation-turn-failed.v1',payload:{...event().payload,terminal_status:'FAILED'}});await expect(s.service.authorize(invalid)).resolves.toEqual({outcome:'NOT_AUTHORIZED_INVALID_EVENT'});expect(s.dataApi.findSession).not.toHaveBeenCalled();});
 it.each([
  ['missing session','session',undefined,'NOT_AUTHORIZED_OWNER_MISMATCH'],
  ['closed session','session',{...session,status:'CLOSED'},'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ['cross-user source','source',undefined,'NOT_AUTHORIZED_OWNER_MISMATCH'],
  ['wrong source role','source',turn({role:'ASSISTANT'}),'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ['non-completed source','source',turn({status:'FAILED'}),'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ['cross-session source','source',turn({session_id:'10000000-0000-4000-8000-000000000099'}),'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ['missing assistant','assistant',undefined,'NOT_AUTHORIZED_NONCANONICAL_TURN'],
  ['noncanonical assistant','assistant',{...assistant,source_turn_id:'10000000-0000-4000-8000-000000000099'},'NOT_AUTHORIZED_NONCANONICAL_TURN'],
 ]as const)('does not issue authority for %s',async(_name,target,value,outcome)=>{const s=setup();if(target==='session')s.dataApi.findSession.mockResolvedValue(value as BackgroundConversationSessionState|undefined);if(target==='source')s.dataApi.findSourceTurn.mockResolvedValue(value as BackgroundConversationTurnState|undefined);if(target==='assistant')s.dataApi.findCompletedAssistant.mockResolvedValue(value as BackgroundConversationTurnState|undefined);const result=await s.service.authorize(event());expect(result).toEqual({outcome});expect(result.context).toBeUndefined();});
});
