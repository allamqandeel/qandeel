import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),session=randomUUID();
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
const CANONICAL=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];
const CURRENT_SQL='SELECT * FROM public.him_current_structured_measurements WHERE measurement_observation_id=$1';
const SNAPSHOT_SQL="SELECT * FROM public.read_him_intelligence_snapshot_v1('CONVERSATION_SESSION',$1) ORDER BY slot_order";
const RESOLVER_SQL="SELECT public.him_active_structured_binding_id('hse.energy',1,'CONVERSATION_SESSION') id";
await client.connect();try{
 // --- Durable selection-contract inventory ----------------------------------
 // The rebuilt shared view keeps every canonical structured route, both
 // historical eligibility filters, and the one-row-per-observation
 // selection with ACTIVE-binding priority. This asserts the CURRENT
 // canonical inventory only - later migrations, metric versions, and
 // separately reviewed runtime functions stay possible.
 const def=(await client.query("SELECT pg_get_viewdef('public.him_current_structured_measurements'::regclass) def")).rows[0].def;
 if(CANONICAL.some(key=>!def.includes(key)))throw new Error('Expected every canonical structured route to survive the binding-transition-safety rebuild');
 if(!def.includes('DISTINCT ON')||!def.includes('him_active_structured_binding_id')||!def.includes('supersedes_observation_id')||!def.includes('him_energy_calculation_supersessions')||!def.includes('snapshot_version DESC'))throw new Error('Expected the one-row-per-observation selection with preserved correction/supersession filters and deterministic fallback ordering');
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[session,one]);
 await client.query('BEGIN');
 // --- Resolver authority stays narrow ----------------------------------------
 await client.query('SET LOCAL ROLE anon');
 await rejects(RESOLVER_SQL);
 await client.query('RESET ROLE');
 const v1=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'")).rows[0];
 if(!v1)throw new Error('Expected the ACTIVE canonical Energy binding');
 await identity(one);
 if((await client.query(RESOLVER_SQL)).rows[0].id!==v1.id)throw new Error('Resolver must return exactly the ACTIVE canonical binding id');
 // --- Phase 1: calculate under canonical binding v1 --------------------------
 const obs1=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[session])).rows[0];
 const snap1=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs1.id])).rows[0];
 if(snap1.canonical_binding_id!==v1.id||snap1.numeric_value!==4)throw new Error('Phase 1 calculation under canonical binding v1 failed');
 let current=(await client.query(CURRENT_SQL,[obs1.id])).rows;
 if(current.length!==1||current[0].id!==snap1.id||current[0].canonical_binding_id!==v1.id)throw new Error('Phase 1 structured-current must be exactly the one v1 snapshot');
 let slots=(await client.query(SNAPSHOT_SQL,[session])).rows;
 const frozenSlotCount=slots.length;
 let energy=slots.filter(row=>row.metric_key==='hse.energy');
 if(energy.length!==1||energy[0].snapshot_id!==snap1.id||energy[0].source_binding_status!=='ACTIVE'||energy[0].canonical_binding_id!==energy[0].active_binding_id)throw new Error('Phase 1 Snapshot energy slot must be backed by the ACTIVE v1 binding');
 // --- Phase 2: legitimate calibrated v2 lifecycle + protected activation -----
 // A real calibrated production model v2, its own exactly-ten-basis
 // approval, and a PENDING successor binding with compatible
 // instrument/scale semantics - inserted through the always-on validation
 // trigger, then activated only through the protected canonical
 // activation path. Every fixture lives inside this transaction and rolls
 // back completely.
 await client.query('RESET ROLE');
 const modelBase="INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES($1,'hse.energy.direct-structured-user-report',$2,'hse.energy',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_USER_REPORT','hse.energy.ordinal-5.v1','{\"required\":[\"measurementObservation\"]}'::jsonb,'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE',$3,now(),now())";
 await client.query(modelBase,['50000000-0000-4000-8000-000000000002',2,'verifier-transition-v2']);
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES('50000000-0000-4000-8000-000000000012','verifier.energy.transition.v2',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.energy.direct-structured-user-report',2,'[\"HSE_CONSTRUCT\",\"DIRECT_REPORT\",\"RIGHT_NOW\",\"CONVERSATION_SESSION\",\"ORDINAL_5\",\"FOUNDER_DESIGN_F1_F2\",\"DETERMINISTIC\",\"EVENT_CORRECTION_MISSINGNESS\",\"SECURITY_BINDING\",\"NO_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')");
 const bindingInsert="INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.energy',1,'CONVERSATION_SESSION',$2,'PENDING','hse.energy.direct-structured-user-report',2,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'verifier.energy.transition.v2',1,now())";
 const b2='50000000-0000-4000-8000-000000000021',b3='50000000-0000-4000-8000-000000000022';
 const nextVersion=(await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION'")).rows[0].v;
 await client.query(bindingInsert,[b2,nextVersion]);
 await identity(one);
 await rejects('SELECT public.activate_him_canonical_model_binding($1)',[b2]);
 await client.query('RESET ROLE');
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[b2]);
 const transitioned=(await client.query('SELECT id,status FROM public.him_canonical_model_bindings WHERE id=ANY($1::uuid[])',[[v1.id,b2]])).rows;
 if(transitioned.find(row=>row.id===v1.id).status!=='RETIRED'||transitioned.find(row=>row.id===b2).status!=='ACTIVE')throw new Error('Protected v1-to-v2 binding transition failed');
 await identity(one);
 if((await client.query(RESOLVER_SQL)).rows[0].id!==b2)throw new Error('Resolver must follow the binding transition to v2');
 // Before any recalculation the single historical row stays visible with
 // its retired source binding observable - never a duplicate row, never a
 // hidden measurement, never a false NO_MEASUREMENT_EVENT shape.
 current=(await client.query(CURRENT_SQL,[obs1.id])).rows;
 if(current.length!==1||current[0].id!==snap1.id||current[0].canonical_binding_id!==v1.id)throw new Error('Pre-recalculation structured-current must preserve exactly the one latest historical v1 snapshot');
 slots=(await client.query(SNAPSHOT_SQL,[session])).rows;
 if(slots.length!==frozenSlotCount)throw new Error('Pre-recalculation Snapshot slot cardinality changed');
 energy=slots.filter(row=>row.metric_key==='hse.energy');
 if(energy.length!==1||energy[0].snapshot_id!==snap1.id||energy[0].active_binding_id!==b2||energy[0].canonical_binding_id!==v1.id||energy[0].source_binding_status!=='RETIRED')throw new Error('Pre-recalculation Snapshot slot must expose the retired incompatible source binding as one bounded row');
 // --- Phase 3: recalculation under the ACTIVE v2 binding ---------------------
 const snap2=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs1.id])).rows[0];
 if(snap2.id===snap1.id||snap2.canonical_binding_id!==b2||snap2.numeric_value!==4)throw new Error('Phase 3 recalculation under ACTIVE v2 failed');
 const history=(await client.query('SELECT (SELECT count(*)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) results,(SELECT count(*)::int FROM public.him_metric_snapshots WHERE measurement_observation_id=$1) snapshots,(SELECT count(DISTINCT canonical_binding_id)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) bindings',[obs1.id])).rows[0];
 if(history.results<2||history.snapshots<2||history.bindings<2)throw new Error('Append-only dual-binding calculation/snapshot history must survive the transition');
 current=(await client.query(CURRENT_SQL,[obs1.id])).rows;
 if(current.length!==1||current[0].id!==snap2.id||current[0].canonical_binding_id!==b2)throw new Error('Post-recalculation structured-current must be exactly the one ACTIVE v2 snapshot');
 slots=(await client.query(SNAPSHOT_SQL,[session])).rows;
 if(slots.length!==frozenSlotCount)throw new Error('Post-recalculation Snapshot slot cardinality changed - the duplicate-row defect returned');
 energy=slots.filter(row=>row.metric_key==='hse.energy');
 if(energy.length!==1||energy[0].snapshot_id!==snap2.id||energy[0].canonical_binding_id!==b2||energy[0].source_binding_status!=='ACTIVE'||energy[0].value_state!=='ASSESSED'||energy[0].numeric_value!==4)throw new Error('Post-recalculation Snapshot slot must be backed by the ACTIVE v2 binding with no incompatibility');
 // --- Race regression: old-binding result committed AFTER the transition -----
 // Durable-ordering equivalent of the calculation-versus-activation race:
 // a retired-binding calculation/snapshot pair lands with a LATER durable
 // snapshot_version than the ACTIVE-binding snapshot. ACTIVE-binding
 // preference must win over mere snapshot recency regardless of insertion
 // order, with no destructive cleanup.
 const obs2=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'LOW',NULL)",[session])).rows[0];
 const snapNew=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs2.id])).rows[0];
 if(snapNew.canonical_binding_id!==b2)throw new Error('Race fixture calculation must run under the ACTIVE v2 binding');
 await client.query('RESET ROLE');
 const lateResult='50000000-0000-4000-8000-000000000031',lateSnapshot='50000000-0000-4000-8000-000000000032';
 const lateVersion=(await client.query("SELECT max(snapshot_version)::int+1 v FROM public.him_metric_snapshots WHERE user_id=$1 AND metric_key='hse.energy' AND context_kind='CONVERSATION_SESSION' AND context_id=$2",[one,session])).rows[0].v;
 await client.query("INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version) VALUES($1,$2,'hse.energy',1,'hse.energy.direct-structured-user-report',1,'CONVERSATION_SESSION',$3,'ASSESSED',2,ARRAY[]::text[],'NONE',ARRAY['measurement-observation:'||$4::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,$5,'DIRECT_STRUCTURED_USER_REPORT',$6,$4::uuid,$7,'hse.energy.ordinal-5.v1',1)",[lateResult,one,session,obs2.id,randomUUID(),obs2.measurement_event_id,v1.id]);
 await client.query("INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version) VALUES($1,$2,'hse.energy',1,'RESOLVED','STATE','ASSESSED',2,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],'CONVERSATION_SESSION',$3,'exact measurement event',$4,'VALID',$5,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,$6,$7,$8,$9,'hse.energy.ordinal-5.v1',1)",[lateSnapshot,one,session,obs2.reported_at,lateVersion,lateResult,obs2.measurement_event_id,obs2.id,v1.id]);
 await identity(one);
 current=(await client.query(CURRENT_SQL,[obs2.id])).rows;
 if(current.length!==1||current[0].id!==snapNew.id||current[0].canonical_binding_id!==b2)throw new Error('ACTIVE-binding preference must beat snapshot recency when an old-binding result commits after the transition');
 slots=(await client.query(SNAPSHOT_SQL,[session])).rows;
 if(slots.length!==frozenSlotCount)throw new Error('Race-ordering Snapshot slot cardinality changed');
 energy=slots.filter(row=>row.metric_key==='hse.energy');
 if(energy.length!==1||energy[0].snapshot_id!==snapNew.id||energy[0].source_binding_status!=='ACTIVE')throw new Error('Race-ordering Snapshot slot must stay the one ACTIVE-binding row');
 // --- Deterministic latest-historical fallback among retired candidates ------
 // A further v2-to-v3 transition with no recalculation leaves every
 // observation on exactly one latest historical snapshot: obs1 falls back
 // to its v2 snapshot and obs2 falls back to the durably latest
 // (late-committed retired-binding) snapshot - deterministically, by
 // snapshot chronology with a stable tie-breaker, never two rows and
 // never a hidden historical measurement.
 await client.query('RESET ROLE');
 await client.query(bindingInsert,[b3,nextVersion+1]);
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[b3]);
 if((await client.query('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[b2])).rows[0].status!=='RETIRED')throw new Error('v2-to-v3 transition must retire v2');
 await identity(one);
 current=(await client.query(CURRENT_SQL,[obs1.id])).rows;
 if(current.length!==1||current[0].id!==snap2.id)throw new Error('obs1 latest-historical fallback must select exactly its newest snapshot');
 current=(await client.query(CURRENT_SQL,[obs2.id])).rows;
 if(current.length!==1||current[0].id!==lateSnapshot)throw new Error('obs2 latest-historical fallback must select exactly the durably latest snapshot');
 slots=(await client.query(SNAPSHOT_SQL,[session])).rows;
 if(slots.length!==frozenSlotCount)throw new Error('Fallback-phase Snapshot slot cardinality changed');
 energy=slots.filter(row=>row.metric_key==='hse.energy');
 if(energy.length!==1||energy[0].source_binding_status!=='RETIRED'||energy[0].canonical_binding_id===energy[0].active_binding_id)throw new Error('Fallback-phase Snapshot slot must expose the retired incompatible source binding as one bounded row');
 // Recalculation under ACTIVE v3 makes the fresh snapshot the unique
 // selected row again while all prior history stays durable.
 const snap3=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs2.id])).rows[0];
 if(snap3.canonical_binding_id!==b3)throw new Error('Recalculation under ACTIVE v3 failed');
 current=(await client.query(CURRENT_SQL,[obs2.id])).rows;
 if(current.length!==1||current[0].id!==snap3.id)throw new Error('Post-v3-recalculation structured-current must be exactly the one ACTIVE v3 snapshot');
 // --- Explicit correction semantics stay untouched ---------------------------
 const correction=(await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'MODERATE',NULL)",[obs2.id])).rows[0];
 if((await client.query(CURRENT_SQL,[obs2.id])).rows.length!==0)throw new Error('A corrected observation must leave structured-current entirely - a binding transition is never a correction and a correction is never a binding transition');
 const durable=(await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots WHERE measurement_observation_id=$1',[obs2.id])).rows[0].n;
 if(durable<3)throw new Error('Correction must never delete the durable multi-binding snapshot history');
 const correctedSnap=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[correction.id])).rows[0];
 current=(await client.query(CURRENT_SQL,[correction.id])).rows;
 if(current.length!==1||current[0].id!==correctedSnap.id||current[0].numeric_value!==3)throw new Error('Corrected-observation currentness failed');
 // --- Cardinality invariant and owner isolation -------------------------------
 const cardinality=(await client.query('SELECT coalesce(max(n),0)::int mx FROM (SELECT count(*) n FROM public.him_current_structured_measurements GROUP BY measurement_observation_id) g')).rows[0].mx;
 if(cardinality>1)throw new Error('Cardinality invariant failed: more than one structured-current row for one observation');
 await client.query('RESET ROLE');await identity(two);
 if((await client.query('SELECT count(*)::int n FROM public.him_current_structured_measurements')).rows[0].n!==0)throw new Error('Owner-only structured-current isolation failed');
 await client.query('ROLLBACK');
 // --- Complete fixture rollback ------------------------------------------------
 const residue=(await client.query("SELECT (SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '50000000-%')+(SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '50000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '50000000-%')+(SELECT count(*) FROM public.him_calculation_results WHERE id::text LIKE '50000000-%')+(SELECT count(*) FROM public.him_metric_snapshots WHERE id::text LIKE '50000000-%') total")).rows[0].total;
 if(Number(residue)!==0)throw new Error('Binding-transition fixtures must roll back completely');
 if((await client.query('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[v1.id])).rows[0].status!=='ACTIVE')throw new Error('The canonical Energy binding must remain ACTIVE after fixture rollback');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Structured Current Binding-Transition Safety v1 (QHIM-001): the shared seventeen-route view keeps its correction and explicit-supersession filters and now exposes at most one current snapshot per unsuperseded observation, the narrow SECURITY DEFINER resolver returns only the ACTIVE binding id with anon execution revoked, a real calibrated v1-to-v2 lifecycle transition through the protected activation path leaves exactly one pre-recalculation historical row whose retired source binding stays observable at frozen Snapshot slot cardinality (incompatible-binding state, never a duplicate-row integrity failure and never a false missing-measurement shape), recalculation under the ACTIVE successor yields exactly one ACTIVE-binding current row while the dual-binding calculation/snapshot history stays append-only, ACTIVE-binding preference beats snapshot recency when an old-binding result commits after the transition (durable race-ordering equivalent), a further v2-to-v3 transition proves the deterministic latest-historical fallback for every stranded observation, explicit correction semantics and currentness stay untouched with no history deletion, the per-observation cardinality invariant holds globally, owner isolation holds, and every model/approval/binding fixture rolls back completely with the canonical Energy binding restored ACTIVE.');
