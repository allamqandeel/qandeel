// Real-PostgreSQL verifier for migration 0052 - HIM Canonical Latest
// Measurement Read Semantics v1 (QHIM-005 + QHIM-007). Proves, on actual
// returned row identities: canonical latest is one fail-closed,
// definition-exact, context-authorized read whose cross-event ordering is
// immutable measurement event chronology (event created_at DESC, event id
// DESC) - never calculation, snapshot, or snapshot-version chronology; a
// late recalculation of an older event cannot beat a newer event; an
// ACTIVE-binding snapshot on an older event cannot beat a newer event's
// historical fallback; explicit correction replaces the value inside its
// original event without rewriting event chronology; equal event timestamps
// resolve deterministically by event id; a newest event with no current
// snapshot returns zero rows instead of backtracking to an older value; an
// unsupported metric/context pair fails closed even while a preserved legacy
// raw snapshot for that exact pair physically exists; ownership and identity
// are owner-exact; and QHIM-001 per-observation binding selection stays
// authoritative underneath. Every fixture rolls back completely.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),sessionMain=randomUUID(),sessionEmpty=randomUUID(),sessionTie=randomUUID(),sessionTwo=randomUUID();
const RPC='public.read_him_latest_measurement_v1(uuid,text,integer,text,text)';
const LATEST_SQL='SELECT * FROM public.read_him_latest_measurement_v1($1,$2,$3,$4,$5)';
const SNAPSHOT_SQL="SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1) ORDER BY slot_order";
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const rejectsWith=async(pattern,params)=>{await client.query('SAVEPOINT expected_rejection');let message='';try{await client.query(LATEST_SQL,params);}catch(error){message=error?.message??'';await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!pattern.test(message))throw new Error(`Expected canonical latest rejection ${pattern} for [${params.slice(1).join(', ')}], got: ${message||'success'}`);};
const latest=async params=>{const rows=(await client.query(LATEST_SQL,params)).rows;if(rows.length>1)throw new Error('Canonical latest returned more than one row');return rows;};
const measurementCounts=async()=>(await client.query('SELECT (SELECT count(*)::int FROM public.him_metric_snapshots) snapshots,(SELECT count(*)::int FROM public.him_measurement_events) events,(SELECT count(*)::int FROM public.him_measurement_observations) observations,(SELECT count(*)::int FROM public.him_calculation_results) results')).rows[0];
await client.connect();try{
 const initialSnapshots=Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n);
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$5,'ACTIVE','TEXT'),($2,$5,'ACTIVE','TEXT'),($3,$5,'ACTIVE','TEXT'),($4,$6,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[sessionMain,sessionEmpty,sessionTie,sessionTwo,one,two]);
 await client.query('BEGIN');
 await identity(one);
 // --- Owned context fixtures on every canonical ownership substrate ----------
 const situationTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('SITUATION','verifier canonical latest situation')")).rows[0];
 const goalTarget=(await client.query("SELECT * FROM public.create_him_motivation_measurement_target('GOAL','verifier canonical latest goal')")).rows[0];
 const relationshipTarget=(await client.query("SELECT * FROM public.create_him_relationship_measurement_target_v1('verifier canonical latest relationship')")).rows[0];
 await client.query('RESET ROLE');
 const decisionTarget='52000000-0000-4000-8000-000000000301';
 await client.query("INSERT INTO public.him_measurement_targets(id,user_id,context_kind,display_text,canonical_provenance) VALUES($1,$2,'DECISION','verifier canonical latest decision','QANDEEL_HIM_MEASUREMENT_TARGET_V1')",[decisionTarget,one]);
 await identity(one);
 // --- Valid owned contexts with no measurement return zero rows --------------
 // Absence is not an error and never a raw fallback, across every canonical
 // ownership substrate and every metric family.
 for(const[key,kind,context]of[['hse.energy','CONVERSATION_SESSION',sessionEmpty],['hbs.avoidance','GOAL',goalTarget.id],['hrs.relationship-trust','RELATIONSHIP',relationshipTarget.id],['hgs.purpose-alignment','GOAL',goalTarget.id],['hse.attention','DECISION',decisionTarget]]){
  if((await latest([one,key,1,kind,context])).length!==0)throw new Error(`Expected zero rows for measured-nothing ${key}/${kind}`);
 }
 // --- Scenario A: two-event chronology ---------------------------------------
 // Event A strictly older than event B, both calculated under the canonical
 // ACTIVE v1 binding: canonical latest is B by event chronology.
 const v1=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'")).rows[0];
 if(!v1)throw new Error('Expected the ACTIVE canonical Energy binding');
 const obsA=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[sessionMain])).rows[0];
 const obsB=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'LOW',NULL)",[sessionMain])).rows[0];
 const eventTimes=(await client.query('SELECT id,created_at FROM public.him_measurement_events WHERE id=ANY($1::uuid[])',[[obsA.measurement_event_id,obsB.measurement_event_id]])).rows;
 const eventA=eventTimes.find(row=>row.id===obsA.measurement_event_id),eventB=eventTimes.find(row=>row.id===obsB.measurement_event_id);
 if(!(eventA.created_at.getTime()<eventB.created_at.getTime()))throw new Error('Fixture invariant: event A must be strictly older than event B');
 const snapA1=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsA.id])).rows[0];
 const snapB1=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsB.id])).rows[0];
 if(!(snapA1.snapshot_version<snapB1.snapshot_version))throw new Error('Fixture invariant: A calculated before B');
 let rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB1.id)throw new Error('Two-event chronology failed: canonical latest must be event B');
 // Result integrity: the returned row's trusted chain matches the exact
 // request and the selected event/observation.
 const returned=rows[0];
 if(returned.user_id!==one||returned.metric_key!=='hse.energy'||returned.definition_version!==1||returned.context_kind!=='CONVERSATION_SESSION'||returned.context_id!==sessionMain)throw new Error('Returned row identity does not match the exact request');
 if(returned.measurement_event_id!==obsB.measurement_event_id||returned.measurement_observation_id!==obsB.id)throw new Error('Returned row is not anchored to the selected newest event/observation');
 const chain=(await client.query('SELECT (SELECT measurement_event_id FROM public.him_measurement_observations WHERE id=$1) observation_event,(SELECT measurement_observation_id FROM public.him_metric_snapshots WHERE id=$2) snapshot_observation',[returned.measurement_observation_id,returned.id])).rows[0];
 if(chain.observation_event!==returned.measurement_event_id||chain.snapshot_observation!==returned.measurement_observation_id)throw new Error('Observation-to-event or snapshot-to-observation chain is inconsistent');
 // Deterministic repeat read.
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB1.id)throw new Error('Canonical latest is not deterministic across repeated reads');
 // Snapshot chronology parity: the Intelligence Snapshot energy slot
 // identifies the same latest event, observation, and snapshot.
 let energySlot=(await client.query(SNAPSHOT_SQL,[sessionMain])).rows.find(row=>row.metric_key==='hse.energy');
 if(energySlot.measurement_event_id!==obsB.measurement_event_id||energySlot.measurement_observation_id!==obsB.id||energySlot.snapshot_id!==snapB1.id)throw new Error('Snapshot parity failed under ordinary two-event state');
 // --- Target-substrate chronology: Stress SITUATION two-event flow -----------
 const obsS1=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'MODERATE',NULL)",[situationTarget.id])).rows[0];
 await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[obsS1.id]);
 const obsS2=(await client.query("SELECT * FROM public.create_hse_stress_measurement('SITUATION',$1,'HIGH',NULL)",[situationTarget.id])).rows[0];
 const snapS2=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[obsS2.id])).rows[0];
 rows=await latest([one,'hse.stress',1,'SITUATION',situationTarget.id]);
 if(rows.length!==1||rows[0].id!==snapS2.id||rows[0].measurement_event_id!==obsS2.measurement_event_id)throw new Error('Target-substrate event chronology failed for Stress/SITUATION');
 // --- QHIM-007: unsupported pair with preserved legacy raw history -----------
 // A historically plausible preserved legacy UNASSESSED raw snapshot for
 // hse.energy@1/SITUATION physically exists, yet canonical latest for that
 // exact pair fails closed on the exact persisted definition and never
 // surfaces the legacy row. Explicit history/audit access still preserves it.
 await client.query('RESET ROLE');
 const legacyContext='verifier legacy situation';
 const legacySnapshot='52000000-0000-4000-8000-000000000201';
 const legacyVersion=Number((await client.query("SELECT coalesce(max(snapshot_version),0)::int+1 v FROM public.him_metric_snapshots WHERE user_id=$1 AND metric_key='hse.energy' AND context_kind='SITUATION' AND context_id=$2",[one,legacyContext])).rows[0].v);
 await client.query("INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at) VALUES($1,$2,'hse.energy',1,'RESOLVED','STATE','UNASSESSED',NULL,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],'SITUATION',$3,'preserved legacy raw history',now(),'VALID',$4,'legacy raw snapshot preserved for audit',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',now())",[legacySnapshot,one,legacyContext,legacyVersion]);
 if(Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots WHERE id=$1',[legacySnapshot])).rows[0].n)!==1)throw new Error('The legacy raw Energy/SITUATION snapshot fixture must physically exist');
 await identity(one);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hse.energy',1,'SITUATION',legacyContext]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hse.energy',1,'SITUATION',situationTarget.id]);
 // The legacy row stays reachable through the explicit owner-scoped
 // history/audit surface - preserved, never canonical.
 const history=(await client.query("SELECT id,value_state FROM public.him_metric_snapshots WHERE user_id=$1 AND metric_key='hse.energy' AND context_kind='SITUATION' AND context_id=$2 ORDER BY snapshot_version",[one,legacyContext])).rows;
 if(history.length!==1||history[0].id!==legacySnapshot||history[0].value_state!=='UNASSESSED')throw new Error('Explicit history access must still preserve the legacy raw row');
 // Representative unsupported pairs across every other family fail closed by
 // the exact persisted definition, never by a hand-written route matrix.
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hbs.avoidance',1,'CONVERSATION_SESSION',sessionMain]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hrs.relationship-trust',1,'SITUATION',situationTarget.id]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hgs.purpose-alignment',1,'SITUATION',situationTarget.id]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hgs.habit-strength',1,'CONVERSATION_SESSION',sessionMain]);
 // --- Ownership, identity, and adversarial authority sweep -------------------
 await rejectsWith(/owner-exact/,[two,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'hse.energy',1,'CONVERSATION_SESSION',sessionTwo]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'hse.energy',1,'CONVERSATION_SESSION',randomUUID()]);
 await rejectsWith(/Unknown or unowned HIM measurement context/,[one,'hse.stress',1,'SITUATION',relationshipTarget.id]);
 await rejectsWith(/Unknown exact HIM metric definition/,[one,'hse.energy',9999,'CONVERSATION_SESSION',sessionMain]);
 await rejectsWith(/Unknown exact HIM metric definition/,[one,'not.a-canonical-metric',1,'CONVERSATION_SESSION',sessionMain]);
 await rejectsWith(/Unknown exact HIM metric definition/,[one,"hse.energy';DROP TABLE public.him_metric_snapshots;--",1,'CONVERSATION_SESSION',sessionMain]);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hse.energy',1,'GLOBAL','GLOBAL']);
 await rejectsWith(/Unsupported context kind for the exact HIM metric definition/,[one,'hse.energy',1,'TOTALLY_BOGUS_KIND',sessionMain]);
 // Unauthenticated: an authenticated role connection with no JWT subject.
 await client.query("SELECT set_config('request.jwt.claims','',true)");
 await rejectsWith(/Authentication required/,[one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 // anon and service_role hold no EXECUTE at all.
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE anon');
 await rejects(LATEST_SQL,[one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 await client.query('RESET ROLE');await client.query('SET LOCAL ROLE service_role');
 await rejects(LATEST_SQL,[one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 await client.query('RESET ROLE');
 // Exact ACL and safe function properties.
 const acl=(await client.query("SELECT has_function_privilege('public',$1,'EXECUTE') public,has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') authenticated,has_function_privilege('service_role',$1,'EXECUTE') service_role",[RPC])).rows[0];
 if(acl.public||acl.anon||acl.service_role||!acl.authenticated)throw new Error('Canonical latest EXECUTE authority must be authenticated-only');
 const props=(await client.query('SELECT p.prosecdef,p.provolatile,p.proconfig,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.oid=$1::regprocedure',[RPC])).rows[0];
 if(!props.prosecdef||props.provolatile!=='s'||!(props.proconfig??[]).some(entry=>entry.startsWith('search_path=')))throw new Error('Canonical latest must be a STABLE SECURITY DEFINER with a fixed search_path');
 if(/EXECUTE\s+format|EXECUTE\s+'/i.test(props.definition))throw new Error('Canonical latest must contain no dynamic SQL');
 if(/snapshot_version/.test(props.definition))throw new Error('Canonical latest must never reference snapshot_version');
 await identity(one);
 // --- Scenario B/C: binding transition, late recalculation of the older event
 // A legitimate calibrated v2 lifecycle through the protected activation
 // path. Recalculating older event A first gives A an ACTIVE-binding
 // snapshot with a HIGHER snapshot_version than newer event B's retired
 // v1 snapshot - canonical latest must still be B (event chronology wins;
 // the RPC did not sort by snapshot_version, snapshot created_at, or
 // calculation-result insertion time, all of which now favour A), and B's
 // one preserved historical fallback row is returned as-is.
 await client.query('RESET ROLE');
 await client.query("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('52000000-0000-4000-8000-000000000002','hse.energy.direct-structured-user-report',2,'hse.energy',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_USER_REPORT','hse.energy.ordinal-5.v1','{\"required\":[\"measurementObservation\"]}'::jsonb,'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','verifier-canonical-latest-v2',now(),now())");
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES('52000000-0000-4000-8000-000000000012','verifier.energy.canonical-latest.v2',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.energy.direct-structured-user-report',2,'[\"HSE_CONSTRUCT\",\"DIRECT_REPORT\",\"RIGHT_NOW\",\"CONVERSATION_SESSION\",\"ORDINAL_5\",\"FOUNDER_DESIGN_F1_F2\",\"DETERMINISTIC\",\"EVENT_CORRECTION_MISSINGNESS\",\"SECURITY_BINDING\",\"NO_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')");
 const b2='52000000-0000-4000-8000-000000000021';
 const nextVersion=Number((await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION'")).rows[0].v);
 await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.energy',1,'CONVERSATION_SESSION',$2,'PENDING','hse.energy.direct-structured-user-report',2,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'verifier.energy.canonical-latest.v2',1,now())",[b2,nextVersion]);
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[b2]);
 if((await client.query('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[v1.id])).rows[0].status!=='RETIRED')throw new Error('The protected v1-to-v2 transition must retire v1');
 await identity(one);
 const snapA2=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsA.id])).rows[0];
 if(snapA2.canonical_binding_id!==b2||!(snapA2.snapshot_version>snapB1.snapshot_version))throw new Error('Late recalculation fixture must give older event A a newer ACTIVE-binding snapshot');
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB1.id||rows[0].canonical_binding_id!==v1.id)throw new Error('Late recalculation of older event A must not beat newer event B, and B must keep its one historical fallback snapshot');
 // Snapshot parity under the adversarial late-recalculation state.
 energySlot=(await client.query(SNAPSHOT_SQL,[sessionMain])).rows.find(row=>row.metric_key==='hse.energy');
 if(energySlot.measurement_event_id!==obsB.measurement_event_id||energySlot.measurement_observation_id!==obsB.id||energySlot.snapshot_id!==snapB1.id||energySlot.source_binding_status!=='RETIRED')throw new Error('Snapshot parity failed under the late-recalculation state');
 // Recalculating newer event B under v2 keeps B latest with its ACTIVE row.
 const snapB2=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsB.id])).rows[0];
 if(snapB2.canonical_binding_id!==b2)throw new Error('Event B recalculation must run under the ACTIVE v2 binding');
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB2.id)throw new Error('Canonical latest must return newer event B with its ACTIVE-binding snapshot after recalculation');
 // --- Scenario D: correction chronology --------------------------------------
 // Correcting and recalculating OLDER event A - even under the ACTIVE
 // binding, with the globally newest snapshot version - never makes A
 // latest. Correction time is not cross-event measurement time.
 const corrA=(await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'MODERATE',NULL)",[obsA.id])).rows[0];
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB2.id)throw new Error('Correcting older event A must not change canonical latest');
 const snapCorrA=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[corrA.id])).rows[0];
 if(!(snapCorrA.snapshot_version>snapB2.snapshot_version))throw new Error('Corrected-A fixture must carry the globally newest snapshot version');
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapB2.id)throw new Error('A corrected and recalculated older event must never masquerade as latest');
 // Correcting NEWEST event B leaves its current observation with no current
 // snapshot: canonical latest returns zero rows and must NOT backtrack to
 // older event A, whose ACTIVE-binding calculated row is sitting right there.
 const corrB=(await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'VERY_HIGH',NULL)",[obsB.id])).rows[0];
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==0)throw new Error('A newest event whose corrected observation has no current snapshot must yield zero rows, never an older event value');
 energySlot=(await client.query(SNAPSHOT_SQL,[sessionMain])).rows.find(row=>row.metric_key==='hse.energy');
 if(energySlot.measurement_observation_id!==corrB.id||energySlot.snapshot_id!==null)throw new Error('Snapshot parity failed for the uncalculated corrected newest event');
 const snapCorrB=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[corrB.id])).rows[0];
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapCorrB.id||rows[0].numeric_value!==5||rows[0].measurement_event_id!==obsB.measurement_event_id)throw new Error('Corrected newest event B must be canonical latest with the corrected value');
 // --- Three events; a brand-new uncalculated newest event ---------------------
 const obsC=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'VERY_LOW',NULL)",[sessionMain])).rows[0];
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==0)throw new Error('A newest event with no current snapshot must yield zero rows across three events');
 const snapC=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obsC.id])).rows[0];
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 if(rows.length!==1||rows[0].id!==snapC.id||rows[0].numeric_value!==1||rows[0].measurement_event_id!==obsC.measurement_event_id||rows[0].measurement_observation_id!==obsC.id)throw new Error('The third, newest event must become canonical latest once calculated');
 // --- Scenario E: equal event timestamps -------------------------------------
 // Two distinct valid event chains with byte-identical created_at: the
 // deterministic winner is max(event id) under uuid descending order. The
 // max-id event is calculated FIRST so it durably holds the LOWER snapshot
 // version - snapshot chronology and snapshot id play no cross-event role.
 await client.query('RESET ROLE');
 const e1='52000000-0000-4000-8000-000000000101',e2='52000000-0000-4000-8000-000000000102';
 const o1='52000000-0000-4000-8000-000000000111',o2='52000000-0000-4000-8000-000000000112';
 await client.query("INSERT INTO public.him_measurement_events(id,user_id,context_kind,context_id,created_at) VALUES($1,$3,'CONVERSATION_SESSION',$4,now()),($2,$3,'CONVERSATION_SESSION',$4,now())",[e1,e2,one,sessionTie]);
 await client.query("INSERT INTO public.him_measurement_observations(id,user_id,measurement_event_id,metric_key,definition_version,instrument_id,instrument_version,scale_contract_reference,scale_version,context_kind,context_id,response_code,reported_at,client_reported_at_untrusted,locale,source,canonical_provenance,created_at) VALUES($1,$3,$4,'hse.energy',1,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'CONVERSATION_SESSION',$6,'HIGH',now(),NULL,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HSE_ENERGY_MEASUREMENT_V1',now()),($2,$3,$5,'hse.energy',1,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'CONVERSATION_SESSION',$6,'LOW',now(),NULL,'ar-EG','DIRECT_STRUCTURED_USER_REPORT','QANDEEL_HSE_ENERGY_MEASUREMENT_V1',now())",[o1,o2,one,e1,e2,sessionTie]);
 const tieTimes=(await client.query('SELECT count(DISTINCT created_at)::int n FROM public.him_measurement_events WHERE id=ANY($1::uuid[])',[[e1,e2]])).rows[0];
 if(Number(tieTimes.n)!==1)throw new Error('Equal-timestamp fixture must carry one identical event created_at');
 await identity(one);
 const snapO2=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[o2])).rows[0];
 const snapO1=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[o1])).rows[0];
 if(!(snapO1.snapshot_version>snapO2.snapshot_version))throw new Error('Equal-timestamp fixture must give the losing event the newer snapshot version');
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionTie]);
 if(rows.length!==1||rows[0].measurement_event_id!==e2||rows[0].id!==snapO2.id||rows[0].numeric_value!==2)throw new Error('Equal event timestamps must resolve deterministically to max(event id), never by snapshot version or snapshot id');
 rows=await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionTie]);
 if(rows.length!==1||rows[0].id!==snapO2.id)throw new Error('The equal-timestamp tie-break is not deterministic across repeated reads');
 // --- Read-only stability, QHIM-001 cardinality, and owner isolation ---------
 await client.query('RESET ROLE');
 const before=await measurementCounts();
 await identity(one);
 await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionMain]);
 await latest([one,'hse.stress',1,'SITUATION',situationTarget.id]);
 await latest([one,'hse.energy',1,'CONVERSATION_SESSION',sessionTie]);
 await client.query('RESET ROLE');
 const after=await measurementCounts();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Canonical latest reads must write no state');
 const cardinality=Number((await client.query('SELECT coalesce(max(n),0)::int mx FROM (SELECT count(*) n FROM public.him_current_structured_measurements GROUP BY measurement_observation_id) g')).rows[0].mx);
 if(cardinality>1)throw new Error('QHIM-001 regression: more than one structured-current row for one observation');
 await identity(two);
 if(Number((await client.query('SELECT count(*)::int n FROM public.him_current_structured_measurements')).rows[0].n)!==0)throw new Error('Owner-only structured-current isolation failed');
 if((await latest([two,'hse.energy',1,'CONVERSATION_SESSION',sessionTwo])).length!==0)throw new Error('The other user must see zero rows for their own empty session');
 await client.query('ROLLBACK');
 // --- Complete fixture rollback ----------------------------------------------
 const residue=Number((await client.query("SELECT (SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_metric_snapshots WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_measurement_events WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_measurement_observations WHERE id::text LIKE '52000000-%')+(SELECT count(*) FROM public.him_measurement_targets WHERE id::text LIKE '52000000-%') total")).rows[0].total);
 if(residue!==0)throw new Error('Canonical-latest fixtures must roll back completely');
 if((await client.query("SELECT status FROM public.him_canonical_model_bindings WHERE id=(SELECT id FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND binding_version=1)")).rows[0].status!=='ACTIVE')throw new Error('The canonical Energy binding must remain ACTIVE after fixture rollback');
 if(Number((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots')).rows[0].n)!==initialSnapshots)throw new Error('The verifier changed the durable snapshot population');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Canonical Latest Measurement Read Semantics v1 (QHIM-005 + QHIM-007): canonical latest is one fail-closed authenticated owner-exact RPC whose EXECUTE authority is authenticated-only with definer/search_path safety and no dynamic SQL; a valid owned context with no measurement returns zero rows on every canonical ownership substrate; across two real measurement events canonical latest is the newer event by immutable event chronology with a fully consistent user/definition/context/event/observation/snapshot chain and deterministic repeat reads, in exact parity with Intelligence Snapshot chronology; a late recalculation of the older event under a legitimately activated v2 binding gives it the globally newest ACTIVE-binding snapshot version and still cannot beat the newer event, whose one preserved retired-binding historical fallback row is returned as-is; correcting and recalculating the older event cannot reorder events, while correcting the newest event yields zero rows until its correction is calculated - never a backtrack to the older calculated value - and then returns the corrected newest value; a brand-new third uncalculated event yields zero rows until calculated; two events with byte-identical timestamps resolve deterministically to the max event id even though the losing event holds the newer snapshot version; the exact preserved legacy raw Energy/SITUATION snapshot physically exists yet canonical latest fails closed on the exact persisted definition for it and for representative HBS/HRS/HGS unsupported pairs while explicit owner-scoped history access still preserves the row; cross-user identity, cross-user contexts, unknown contexts, unknown metrics/versions, SQL-ish metric text, non-canonical context kinds, unauthenticated and anon calls all fail closed; reads write no state, the QHIM-001 one-row-per-observation invariant and owner isolation hold, and every fixture rolls back completely with the canonical Energy binding restored ACTIVE and the durable snapshot population unchanged.');
