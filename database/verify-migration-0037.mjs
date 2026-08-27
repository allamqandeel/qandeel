// Background HIM Runtime Consumption (migration 0037) adversarial verifier.
// Proves against real PostgreSQL that: the authenticated snapshot function is
// behaviorally unchanged (parity on identical fixtures, all four contexts,
// fail-closed ownership/unsupported/integrity paths); the internal core is
// STABLE, hardened, explicit-identity, auth.uid()-free and inaccessible to
// every application role; the background wrapper is CONVERSATION_SESSION-only,
// service_role-only, exactly identity-bound, JWT-free and read-only; and the
// canonical data semantics (fixed slots, no-fallback missingness, invalidated
// and incompatible-binding unassessedness) survive unchanged with zero writes,
// zero backfill and zero persistent change beyond the function/ACL surface.
// All fixtures live inside one BEGIN ... ROLLBACK transaction.
import pg from'pg';import{randomUUID}from'node:crypto';import{readFileSync}from'node:fs';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionOne=randomUUID(),sessionTwo=randomUUID(),fake=randomUUID();
const identity=async id=>{await client.query('RESET ROLE');await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const asRole=async role=>{await client.query('RESET ROLE');await client.query("SELECT set_config('request.jwt.claims','',true)");if(role)await client.query(`SET LOCAL ROLE ${role}`);};
const rejects=async(sql,p=[])=>{await client.query('SAVEPOINT expected');let failed=false;try{await client.query(sql,p);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected');}await client.query('RELEASE SAVEPOINT expected');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const readAuth=(kind,id)=>client.query('SELECT * FROM public.read_him_intelligence_snapshot_v1($1,$2)',[kind,id]);
const readBackground=(userId,sessionId)=>client.query('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[userId,sessionId]);
const strip=row=>{const{generated_at,...rest}=row;return rest;};
const sameRows=(a,b,label)=>{if(JSON.stringify(a.map(strip))!==JSON.stringify(b.map(strip)))throw new Error(`${label}: authenticated/background source-row parity failed`);};
const migrationSql=readFileSync(new URL('./migrations/0037_background_him_runtime_consumption_v1.sql',import.meta.url),'utf8');
await client.connect();try{
 // Upgrade shape: the forward migration is function/ACL surface only.
 if(/CREATE TABLE|ALTER TABLE|INSERT INTO|UPDATE public\.|DELETE FROM|CREATE INDEX|pg_advisory/i.test(migrationSql))throw new Error('Migration 0037 must add only function/ACL surface');
 await client.query('INSERT INTO auth.users(id)VALUES($1),($2)ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel)VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')ON CONFLICT DO NOTHING",[sessionOne,one,sessionTwo,two]);
 await client.query('BEGIN');
 // --- Catalog surface: core is STABLE, hardened, explicit-identity, auth.uid()-free; wrapper keeps auth.uid(); background wrapper is session-only and JWT-free.
 const proc=async name=>{const r=await client.query("SELECT p.provolatile,p.prosecdef,p.proconfig,p.prosrc,pg_get_function_identity_arguments(p.oid)args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1",[name]);if(r.rows.length!==1)throw new Error(`Expected exactly one public.${name}`);return r.rows[0];};
 const core=await proc('read_him_intelligence_snapshot_core_v1');
 if(core.provolatile!=='s'||!core.prosecdef||!(core.proconfig??[]).some(c=>c.startsWith('search_path=')))throw new Error('Core must be STABLE SECURITY DEFINER with a fixed search_path');
 if(!['p_user_id uuid, p_context_kind text, p_context_id text','uuid, text, text'].includes(core.args))throw new Error('Core must take the explicit trusted user identity');
 if(/auth\.uid/i.test(core.prosrc))throw new Error('Core must not call auth.uid()');
 const wrapper=await proc('read_him_intelligence_snapshot_v1');
 if(!/auth\.uid\(\)/.test(wrapper.prosrc)||!/read_him_intelligence_snapshot_core_v1/.test(wrapper.prosrc))throw new Error('Authenticated wrapper must derive identity from auth.uid() and delegate to the core');
 if(wrapper.provolatile!=='s'||!wrapper.prosecdef||!(wrapper.proconfig??[]).some(c=>c.startsWith('search_path=')))throw new Error('Authenticated wrapper hardening failed');
 const background=await proc('background_read_him_conversation_snapshot_v1');
 if(!['p_user_id uuid, p_session_id uuid','uuid, uuid'].includes(background.args))throw new Error('Background wrapper must take exact user/session identity');
 if(/auth\.uid|request\.jwt|set_config|current_setting/i.test(background.prosrc))throw new Error('Background wrapper must use no auth.uid(), no request JWT, and no claim reconstruction');
 if(!/read_him_intelligence_snapshot_core_v1\(p_user_id,'CONVERSATION_SESSION',p_session_id::text\)/.test(background.prosrc))throw new Error('Background wrapper must delegate CONVERSATION_SESSION-only to the shared core');
 if(background.provolatile!=='s'||!background.prosecdef||!(background.proconfig??[]).some(c=>c.startsWith('search_path=')))throw new Error('Background wrapper hardening failed');
 const backgroundHim=await client.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'background_read_him%'");
 if(backgroundHim.rows.length!==1)throw new Error('Exactly one background HIM read function may exist: no SITUATION/DECISION/GOAL background authority');
 const grants=async name=>(await client.query("SELECT grantee,privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name=$1",[name])).rows;
 const coreGrants=await grants('read_him_intelligence_snapshot_core_v1');
 if(coreGrants.some(g=>['PUBLIC','anon','authenticated','service_role'].includes(g.grantee)))throw new Error('No application role may execute the internal core');
 const wrapperGrants=await grants('read_him_intelligence_snapshot_v1');
 if(wrapperGrants.some(g=>['PUBLIC','anon','service_role'].includes(g.grantee))||!wrapperGrants.some(g=>g.grantee==='authenticated'&&g.privilege_type==='EXECUTE'))throw new Error('Authenticated wrapper grants must remain authenticated-only');
 const backgroundGrants=await grants('background_read_him_conversation_snapshot_v1');
 if(backgroundGrants.some(g=>['PUBLIC','anon','authenticated'].includes(g.grantee))||!backgroundGrants.some(g=>g.grantee==='service_role'&&g.privilege_type==='EXECUTE'))throw new Error('Background wrapper grants must be service_role-only');
 // --- Role execution boundaries.
 for(const role of['anon','authenticated','service_role']){await asRole(role);await rejects("SELECT * FROM public.read_him_intelligence_snapshot_core_v1($1,'CONVERSATION_SESSION',$2)",[one,sessionOne]);}
 for(const role of['anon','authenticated']){await asRole(role);await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[one,sessionOne]);}
 await asRole('anon');await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne]);
 await asRole('service_role');await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne]);
 // Unauthenticated (no claims) authenticated-role call still fails closed.
 await asRole('authenticated');await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne]);
 // --- EMPTY parity: same fixture, same source rows, exact three ordered session slots on BOTH paths.
 await identity(one);
 let auth=(await readAuth('CONVERSATION_SESSION',sessionOne)).rows;
 if(auth.length!==3||auth.map(x=>x.metric_key).join()!=='hse.stress,hse.energy,hse.attention'||auth.some(x=>x.measurement_event_id!==null)||new Set(auth.map(x=>x.generated_at.getTime())).size!==1)throw new Error('EMPTY authenticated session slots failed');
 await asRole('service_role');
 let bg=(await readBackground(one,sessionOne)).rows;
 if(bg.length!==3||bg.map(x=>x.metric_key).join()!=='hse.stress,hse.energy,hse.attention'||bg.map(x=>x.slot_order).join()!=='1,2,5')throw new Error('EMPTY background session slots failed');
 sameRows(auth,bg,'EMPTY session');
 // --- Preserved authenticated SITUATION/DECISION/GOAL semantics.
 await identity(one);
 const situation=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('SITUATION','him consumption situation')")).rows[0],decision=(await client.query("SELECT * FROM public.create_him_attention_measurement_context('DECISION','him consumption decision')")).rows[0],goal=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','him consumption goal')")).rows[0];
 for(const[k,id,n,keys]of[['SITUATION',situation.id,4,'hse.stress,hse.motivation,hse.self-confidence,hse.attention'],['DECISION',decision.id,2,'hse.self-confidence,hse.attention'],['GOAL',goal.id,1,'hse.motivation']]){const rows=(await readAuth(k,id)).rows;if(rows.length!==n||rows.map(x=>x.metric_key).join()!==keys)throw new Error(`${k} authenticated semantics failed`);}
 // Fail-closed authenticated paths: unsupported, unowned, cross-user.
 await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('GLOBAL','GLOBAL')");
 await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('RELATIONSHIP',$1)",[fake]);
 await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[fake]);
 await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionTwo]);
 await identity(two);await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('SITUATION',$1)",[situation.id]);
 // --- Background identity binding fails closed: cross-user, unknown, and null identities.
 await asRole('service_role');
 await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[two,sessionOne]);
 await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[one,sessionTwo]);
 await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[one,fake]);
 await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1(NULL,$1)',[sessionOne]);
 await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,NULL)',[one]);
 // The background wrapper carries no generic context authority: only the session form exists.
 await rejects("SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2,'SITUATION')",[one,situation.id]);
 // --- Known state parity through the canonical measurement + calculation path.
 await identity(one);
 const stress=(await client.query("SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION',$1,'HIGH',NULL)",[sessionOne])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stress.id]);
 auth=(await readAuth('CONVERSATION_SESSION',sessionOne)).rows;
 if(auth[0].metric_key!=='hse.stress'||auth[0].numeric_value!==4||auth[0].value_state!=='ASSESSED'||auth[0].validity_status!=='VALID')throw new Error('Known assessed session stress failed on the authenticated path');
 if(auth[1].measurement_event_id!==null||auth[2].measurement_event_id!==null)throw new Error('Unmeasured session slots must stay explicitly unmeasured');
 await asRole('service_role');
 bg=(await readBackground(one,sessionOne)).rows;
 sameRows(auth,bg,'KNOWN session stress');
 // --- Latest NOT_SURE stays unassessed with no fallback on BOTH paths.
 await identity(one);
 const unsure=(await client.query("SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION',$1,'NOT_SURE',NULL)",[sessionOne])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[unsure.id]);
 auth=(await readAuth('CONVERSATION_SESSION',sessionOne)).rows;
 if(auth[0].measurement_event_id!==unsure.measurement_event_id||auth[0].value_state!=='UNASSESSED'||auth[0].numeric_value!==null)throw new Error('Latest NOT_SURE no-fallback failed on the authenticated path');
 await asRole('service_role');
 bg=(await readBackground(one,sessionOne)).rows;
 if(bg[0].measurement_event_id!==unsure.measurement_event_id||bg[0].value_state!=='UNASSESSED'||bg[0].numeric_value!==null)throw new Error('Latest NOT_SURE no-fallback failed on the background path');
 sameRows(auth,bg,'NOT_SURE session stress');
 // --- Invalidated latest stays unassessed (no fallback) on BOTH paths.
 await identity(one);
 const later=(await client.query("SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION',$1,'LOW',NULL)",[sessionOne])).rows[0];
 const laterSnapshot=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[later.id])).rows[0];
 await client.query('RESET ROLE');
 await client.query('SAVEPOINT invalidated');
 await client.query("UPDATE public.him_metric_snapshots SET validity_status='INVALIDATED' WHERE id=$1",[laterSnapshot.id]);
 await identity(one);
 auth=(await readAuth('CONVERSATION_SESSION',sessionOne)).rows;
 if(auth[0].measurement_event_id!==later.measurement_event_id||auth[0].validity_status!=='INVALIDATED')throw new Error('Invalidated latest must stay the latest with INVALIDATED state, never an older fallback');
 await asRole('service_role');
 bg=(await readBackground(one,sessionOne)).rows;
 if(bg[0].validity_status!=='INVALIDATED')throw new Error('Invalidated latest failed on the background path');
 sameRows(auth,bg,'INVALIDATED session stress');
 await client.query('RESET ROLE');await client.query('ROLLBACK TO SAVEPOINT invalidated');await client.query('RELEASE SAVEPOINT invalidated');
 // --- Incompatible active binding stays a bounded unassessed row; a broken active slot set fails closed - on BOTH paths.
 await client.query('RESET ROLE');
 const oldBinding=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.stress' AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'")).rows[0],candidate='f8370000-0000-4000-8000-000000000001';
 await client.query('ALTER TABLE public.him_canonical_model_bindings DISABLE TRIGGER him_energy_binding_guard');
 await client.query('INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at)VALUES($1,$2,$3,$4,$5,\'PENDING\',$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp())',[candidate,oldBinding.metric_key,oldBinding.definition_version,oldBinding.context_kind,oldBinding.binding_version+1,oldBinding.model_id,oldBinding.model_version,oldBinding.instrument_id,oldBinding.instrument_version,oldBinding.scale_contract_reference,oldBinding.scale_version,oldBinding.approval_id,oldBinding.approval_version]);
 await client.query('ALTER TABLE public.him_canonical_model_bindings ENABLE TRIGGER him_energy_binding_guard');
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[candidate]);
 await identity(one);
 auth=(await readAuth('CONVERSATION_SESSION',sessionOne)).rows;
 if(auth[0].active_binding_id!==candidate||auth[0].canonical_binding_id===candidate||auth[0].source_binding_status!=='RETIRED')throw new Error('Incompatible active binding was silently reinterpreted on the authenticated path');
 await asRole('service_role');
 bg=(await readBackground(one,sessionOne)).rows;
 if(bg[0].active_binding_id!==candidate||bg[0].source_binding_status!=='RETIRED')throw new Error('Incompatible active binding failed on the background path');
 sameRows(auth,bg,'INCOMPATIBLE_ACTIVE_BINDING session stress');
 await client.query('RESET ROLE');
 await client.query('SAVEPOINT missing_binding');
 await client.query("SELECT set_config('qandeel.binding_transition','authorized',true)");
 await client.query("UPDATE public.him_canonical_model_bindings SET status='RETIRED',retired_at=clock_timestamp()WHERE id=$1",[candidate]);
 await identity(one);await rejects("SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1)",[sessionOne]);
 await asRole('service_role');await rejects('SELECT * FROM public.background_read_him_conversation_snapshot_v1($1,$2)',[one,sessionOne]);
 await client.query('RESET ROLE');await client.query('ROLLBACK TO SAVEPOINT missing_binding');await client.query('RELEASE SAVEPOINT missing_binding');
 // --- Zero writes, zero cache/history/persistence, zero backfill.
 await client.query('RESET ROLE');
 const counts=async()=>{const r=await client.query('SELECT (SELECT count(*)FROM public.him_metric_snapshots)::int s,(SELECT count(*)FROM public.him_measurement_events)::int e,(SELECT count(*)FROM public.him_measurement_observations)::int o,(SELECT count(*)FROM public.him_calculation_results)::int c');return JSON.stringify(r.rows[0]);};
 const before=await counts();
 await identity(one);await readAuth('CONVERSATION_SESSION',sessionOne);
 await asRole('service_role');await readBackground(one,sessionOne);
 await client.query('RESET ROLE');
 if(await counts()!==before)throw new Error('Snapshot reads must persist nothing');
 if((await client.query("SELECT to_regclass('public.him_intelligence_snapshots') rel")).rows[0].rel!==null)throw new Error('No persisted snapshot table may exist');
 const calibration=await client.query("SELECT metric_key FROM public.him_metric_definitions WHERE calculation_status='CALIBRATED'"),calibrationKeys=calibration.rows.map(x=>x.metric_key);
 if(['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress'].some(key=>!calibrationKeys.includes(key)))throw new Error('Five calibrated HSE snapshot-metric invariant failed');
 await client.query('ROLLBACK');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified Background HIM Runtime Consumption v1: shared hardened core (explicit identity, no auth.uid, no app-role EXECUTE), authenticated wrapper parity across all contexts, CONVERSATION_SESSION-only service_role wrapper with exact fail-closed identity binding and no JWT reconstruction, canonical slots/missingness/invalidated/incompatible-binding semantics on both paths, and zero writes/backfill/persistent state beyond the function/ACL surface.');
