// Real-PostgreSQL verifier for migration 0053 - HIM Legacy Energy Current
// Authority Reconciliation v1 (QHIM-012). Proves against the FINAL LIVE
// SCHEMA, on actual returned row identities and real application-role
// behavior, that public.him_current_energy_measurements is no longer an
// independent current authority: it is a narrow backward-compatibility
// projection over public.him_current_structured_measurements pinned to exactly
// hse.energy@1, it inherits every QHIM-001 currentness semantic by delegation
// rather than restating any of them, it never leaks a non-Energy structured
// snapshot, it never becomes a latest-across-events authority (that stays
// public.read_him_latest_measurement_v1), and a legitimate future hse.energy@2
// remains legal while being unable to enter this versionless legacy surface.
// Semantic properties are proven - no byte-exact SQL formatting is required.
// Every fixture lives inside one transaction and rolls back completely; no
// measurement history is deleted to satisfy any assertion.
import pg from'pg';import{randomUUID}from'node:crypto';import{cleanupVerifierUsers}from'./verifier-fixture-cleanup.mjs';
const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one=randomUUID(),two=randomUUID(),session=randomUUID(),sessionTwo=randomUUID();
const LEGACY='public.him_current_energy_measurements';
const CANONICAL='public.him_current_structured_measurements';
const LEGACY_BY_OBSERVATION=`SELECT * FROM ${LEGACY} WHERE measurement_observation_id=$1`;
const CANONICAL_BY_OBSERVATION=`SELECT * FROM ${CANONICAL} WHERE measurement_observation_id=$1`;
const LEGACY_BY_EVENT=`SELECT * FROM ${LEGACY} WHERE measurement_event_id=$1`;
const CANONICAL_BY_EVENT=`SELECT * FROM ${CANONICAL} WHERE measurement_event_id=$1 AND metric_key='hse.energy' AND definition_version=1`;
// Set-level parity: the compatibility projection is exactly the Energy v1
// slice of the canonical authority - proven in both directions, so it can
// neither hide a canonical row nor invent one.
const PARITY_SQL=`SELECT ((SELECT count(*) FROM(SELECT id FROM ${LEGACY} EXCEPT SELECT id FROM ${CANONICAL} WHERE metric_key='hse.energy' AND definition_version=1)extra)+(SELECT count(*) FROM(SELECT id FROM ${CANONICAL} WHERE metric_key='hse.energy' AND definition_version=1 EXCEPT SELECT id FROM ${LEGACY})missing))::int drift`;
const parityDrift=async()=>(await client.query(PARITY_SQL)).rows[0].drift;
const identity=async id=>{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);};
const rejects=async(sql,params=[])=>{await client.query('SAVEPOINT expected_rejection');let failed=false;try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
await client.connect();try{
 // === V1 - Compatibility definition, row shape, and privileges =============
 // Catalog and privilege inspection of the INSTALLED object, not migration
 // text. The compatibility view must delegate, must be exact to hse.energy@1,
 // must own no competing selection algorithm, must keep the
 // him_metric_snapshots-compatible row shape, must stay security_invoker, and
 // must carry only the intended read grant.
 const legacyDef=(await client.query(`SELECT pg_get_viewdef('${LEGACY}'::regclass) def`)).rows[0].def;
 const canonicalDef=(await client.query(`SELECT pg_get_viewdef('${CANONICAL}'::regclass) def`)).rows[0].def;
 if(!legacyDef.includes('him_current_structured_measurements'))throw new Error('V1: the legacy Energy surface must delegate to the canonical structured-current authority');
 if(!/metric_key\s*=\s*'hse\.energy'/.test(legacyDef))throw new Error('V1: the legacy Energy surface must be restricted to hse.energy');
 if(!/definition_version\s*=\s*1\b/.test(legacyDef))throw new Error('V1: the legacy Energy surface must be exact to definition version 1');
 for(const forbidden of['him_metric_snapshots','him_measurement_observations','him_measurement_events','him_energy_calculation_supersessions','supersedes_observation_id','him_active_structured_binding_id','DISTINCT','ORDER BY','LIMIT','JOIN'])
  if(legacyDef.includes(forbidden))throw new Error(`V1: the legacy Energy surface must not restate ${forbidden} - selection semantics are inherited by delegation`);
 // The canonical authority still owns the QHIM-001 algorithm and is untouched.
 if(!canonicalDef.includes('DISTINCT ON')||!canonicalDef.includes('him_active_structured_binding_id')||!canonicalDef.includes('him_energy_calculation_supersessions')||!canonicalDef.includes('supersedes_observation_id'))throw new Error('V1: the canonical structured-current authority lost the QHIM-001 selection contract');
 const shape=(await client.query(`SELECT (SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='${LEGACY}'::regclass AND attnum>0 AND NOT attisdropped) view_shape,(SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.him_metric_snapshots'::regclass AND attnum>0 AND NOT attisdropped) snapshot_shape,(SELECT 'security_invoker=true'=ANY(coalesce(reloptions,ARRAY[]::text[])) FROM pg_class WHERE oid='${LEGACY}'::regclass) invoker`)).rows[0];
 if(JSON.stringify(shape.view_shape)!==JSON.stringify(shape.snapshot_shape))throw new Error('V1: the compatibility surface lost its him_metric_snapshots-compatible row shape');
 if(shape.invoker!==true)throw new Error('V1: the compatibility surface must remain security_invoker=true');
 const acl=(await client.query(`SELECT has_table_privilege('authenticated','${LEGACY}','SELECT') auth_select,has_table_privilege('anon','${LEGACY}','SELECT') anon_select,has_table_privilege('public','${LEGACY}','SELECT') public_select,has_table_privilege('authenticated','${LEGACY}','INSERT') auth_insert,has_table_privilege('authenticated','${LEGACY}','UPDATE') auth_update,has_table_privilege('authenticated','${LEGACY}','DELETE') auth_delete,has_table_privilege('service_role','${LEGACY}','SELECT') service_legacy,has_table_privilege('service_role','${CANONICAL}','SELECT') service_canonical`)).rows[0];
 if(acl.auth_select!==true)throw new Error('V1: authenticated must retain SELECT on the compatibility surface');
 if(acl.anon_select||acl.public_select)throw new Error('V1: anon and PUBLIC must not read the compatibility surface');
 if(acl.auth_insert||acl.auth_update||acl.auth_delete)throw new Error('V1: the compatibility surface must stay read-only for authenticated');
 // The compatibility surface hands service_role nothing the canonical
 // authority it projects does not already carry in this deployment, so this
 // task introduced no new application-facing read authority for it.
 if(acl.service_legacy!==acl.service_canonical)throw new Error('V1: the compatibility surface must grant service_role no authority beyond the canonical authority it projects');
 // The canonical latest-across-events authority is a different object and is
 // untouched: no latest semantics moved into the compatibility view.
 if((await client.query("SELECT to_regprocedure('public.read_him_latest_measurement_v1(uuid,text,integer,text,text)') p")).rows[0].p===null)throw new Error('V1: the canonical latest-across-events authority must remain installed');

 // Baseline-relative rollback evidence. The Energy definition-version
 // inventory is captured rather than assumed, so this verifier still passes
 // once canonical main legitimately contains a later Energy definition
 // version - it proves its own fixture rolled back, never that no future
 // Energy version may exist.
 const energyVersions=async()=>(await client.query("SELECT definition_version FROM public.him_metric_definitions WHERE metric_key='hse.energy' ORDER BY definition_version")).rows.map(row=>row.definition_version).join(',');
 const baselineEnergyVersions=await energyVersions();
 await client.query('INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING',[one,two]);
 await client.query("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT') ON CONFLICT DO NOTHING",[session,one,sessionTwo,two]);
 await client.query('BEGIN');
 await client.query('RESET ROLE');
 const activeV1=(await client.query("SELECT * FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION' AND status='ACTIVE'")).rows[0];
 if(!activeV1)throw new Error('Expected the ACTIVE canonical Energy v1 binding');
 await identity(one);

 // === V2 - Ordinary Energy v1 parity ======================================
 const obs1=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'HIGH',NULL)",[session])).rows[0];
 const snap1=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs1.id])).rows[0];
 if(snap1.canonical_binding_id!==activeV1.id||snap1.numeric_value!==4)throw new Error('V2: the Energy v1 calculation fixture failed');
 let canonicalRows=(await client.query(CANONICAL_BY_OBSERVATION,[obs1.id])).rows;
 let legacyRows=(await client.query(LEGACY_BY_OBSERVATION,[obs1.id])).rows;
 if(canonicalRows.length!==1||legacyRows.length!==1||canonicalRows[0].id!==snap1.id||legacyRows[0].id!==canonicalRows[0].id)throw new Error('V2: canonical structured-current and the compatibility surface must both return exactly the one same snapshot');
 if(await parityDrift()!==0)throw new Error('V2: the compatibility surface is not exactly the Energy v1 slice of the canonical authority');

 // === V3 - Binding-transition parity =====================================
 // The reproduced QHIM-012 defect class: one unsuperseded Energy v1
 // observation calculated under two successive canonical bindings. A real
 // calibrated successor model, its own exactly-ten-basis approval, and a
 // PENDING successor binding are inserted through the always-on validation
 // trigger and activated only through the protected activation authority.
 await client.query('RESET ROLE');
 const successorModelVersion=(await client.query("SELECT coalesce(max(model_version),0)::int+1 v FROM public.him_calculation_models WHERE model_id='hse.energy.direct-structured-user-report'")).rows[0].v;
 await client.query("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES('53000000-0000-4000-8000-000000000002','hse.energy.direct-structured-user-report',$1,'hse.energy',1,'CALIBRATED','PRODUCTION','QANDEEL_HIM_GOVERNANCE','TEST_ONLY_VERIFIER','DIRECT_STRUCTURED_USER_REPORT','hse.energy.ordinal-5.v1','{\"required\":[\"measurementObservation\"]}'::jsonb,'FIRST_CLASS_HIM_MEASUREMENT_OBSERVATION_V1',ARRAY['CONVERSATION_SESSION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','qhim012-verifier-successor',now(),now())",[successorModelVersion]);
 await client.query("INSERT INTO public.him_governance_approvals(id,approval_id,approval_version,authority_id,authority_version,model_id,model_version,approval_basis,external_validation_claimed,approved_at,canonical_source) VALUES('53000000-0000-4000-8000-000000000012','verifier.energy.qhim012.successor',1,'QANDEEL_FOUNDATION_GOVERNANCE',1,'hse.energy.direct-structured-user-report',$1,'[\"HSE_CONSTRUCT\",\"DIRECT_REPORT\",\"RIGHT_NOW\",\"CONVERSATION_SESSION\",\"ORDINAL_5\",\"FOUNDER_DESIGN_F1_F2\",\"DETERMINISTIC\",\"EVENT_CORRECTION_MISSINGNESS\",\"SECURITY_BINDING\",\"NO_EXTERNAL_VALIDATION_CLAIM\"]'::jsonb,false,now(),'VERIFIER')",[successorModelVersion]);
 const successor='53000000-0000-4000-8000-000000000021';
 const successorBindingVersion=(await client.query("SELECT max(binding_version)::int+1 v FROM public.him_canonical_model_bindings WHERE metric_key='hse.energy' AND definition_version=1 AND context_kind='CONVERSATION_SESSION'")).rows[0].v;
 await client.query("INSERT INTO public.him_canonical_model_bindings(id,metric_key,definition_version,context_kind,binding_version,status,model_id,model_version,instrument_id,instrument_version,scale_contract_reference,scale_version,approval_id,approval_version,effective_at) VALUES($1,'hse.energy',1,'CONVERSATION_SESSION',$2,'PENDING','hse.energy.direct-structured-user-report',$3,'hse.energy.ar-eg.right-now',1,'hse.energy.ordinal-5.v1',1,'verifier.energy.qhim012.successor',1,now())",[successor,successorBindingVersion,successorModelVersion]);
 await identity(one);
 await rejects('SELECT public.activate_him_canonical_model_binding($1)',[successor]);
 await client.query('RESET ROLE');
 await client.query('SELECT public.activate_him_canonical_model_binding($1)',[successor]);
 const transitioned=(await client.query('SELECT id,status FROM public.him_canonical_model_bindings WHERE id=ANY($1::uuid[])',[[activeV1.id,successor]])).rows;
 if(transitioned.find(row=>row.id===activeV1.id).status!=='RETIRED'||transitioned.find(row=>row.id===successor).status!=='ACTIVE')throw new Error('V3: the protected canonical binding transition failed');
 await identity(one);
 const snap2=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs1.id])).rows[0];
 if(snap2.id===snap1.id||snap2.canonical_binding_id!==successor)throw new Error('V3: recalculation under the ACTIVE successor binding failed');
 const durableHistory=(await client.query('SELECT (SELECT count(*)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) results,(SELECT count(*)::int FROM public.him_metric_snapshots WHERE measurement_observation_id=$1) snapshots,(SELECT count(DISTINCT canonical_binding_id)::int FROM public.him_calculation_results WHERE measurement_observation_id=$1) bindings,(SELECT count(*)::int FROM public.him_metric_snapshots WHERE id=$2) old_snapshot',[obs1.id,snap1.id])).rows[0];
 if(durableHistory.results<2||durableHistory.snapshots<2||durableHistory.bindings<2||durableHistory.old_snapshot!==1)throw new Error('V3: append-only dual-binding history must survive and the old historical snapshot must stay durable');
 canonicalRows=(await client.query(CANONICAL_BY_OBSERVATION,[obs1.id])).rows;
 legacyRows=(await client.query(LEGACY_BY_OBSERVATION,[obs1.id])).rows;
 if(canonicalRows.length!==1||legacyRows.length!==1||canonicalRows[0].id!==snap2.id||legacyRows[0].id!==canonicalRows[0].id||legacyRows[0].canonical_binding_id!==successor)throw new Error('V3: after the binding transition both surfaces must select exactly the same one ACTIVE-binding snapshot');

 // === V4 - ACTIVE binding beats later raw snapshot recency ================
 // The 0050 race-ordering condition, reused: a retired-binding snapshot lands
 // with a LATER durable snapshot_version than the ACTIVE-binding snapshot.
 // The compatibility surface must return exactly the row canonical
 // structured-current selects; it implements no recency choice of its own.
 const obs2=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'LOW',NULL)",[session])).rows[0];
 const snapActive=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs2.id])).rows[0];
 if(snapActive.canonical_binding_id!==successor)throw new Error('V4: the race fixture must calculate under the ACTIVE successor binding');
 await client.query('RESET ROLE');
 const lateResult='53000000-0000-4000-8000-000000000031',lateSnapshot='53000000-0000-4000-8000-000000000032';
 const lateVersion=(await client.query("SELECT max(snapshot_version)::int+1 v FROM public.him_metric_snapshots WHERE user_id=$1 AND metric_key='hse.energy' AND context_kind='CONVERSATION_SESSION' AND context_id=$2",[one,session])).rows[0].v;
 await client.query("INSERT INTO public.him_calculation_results(id,user_id,metric_key,definition_version,model_id,model_version,context_kind,context_id,result_state,numeric_value,missing_input_keys,contradiction_state,supporting_evidence_refs,contradictory_evidence_refs,provenance,confidence_state,confidence_reference,trace_id,update_reason,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version) VALUES($1,$2,'hse.energy',1,'hse.energy.direct-structured-user-report',1,'CONVERSATION_SESSION',$3,'ASSESSED',2,ARRAY[]::text[],'NONE',ARRAY['measurement-observation:'||$4::text],ARRAY[]::text[],'QANDEEL_HIM_CALCULATION_RUNTIME_V1','UNASSESSED',NULL,$5,'DIRECT_STRUCTURED_USER_REPORT',$6,$4::uuid,$7,'hse.energy.ordinal-5.v1',1)",[lateResult,one,session,obs2.id,randomUUID(),obs2.measurement_event_id,activeV1.id]);
 await client.query("INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_mapping_status,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at,calculation_result_id,measurement_event_id,measurement_observation_id,canonical_binding_id,scale_contract_reference,scale_version) VALUES($1,$2,'hse.energy',1,'RESOLVED','STATE','ASSESSED',2,'UNASSESSED',NULL,ARRAY[]::text[],ARRAY[]::text[],ARRAY['QANDEEL_HIM_RUNTIME'],'CONVERSATION_SESSION',$3,'exact measurement event',$4,'VALID',$5,'DIRECT_STRUCTURED_USER_REPORT',ARRAY[]::text[],'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP,$6,$7,$8,$9,'hse.energy.ordinal-5.v1',1)",[lateSnapshot,one,session,obs2.reported_at,lateVersion,lateResult,obs2.measurement_event_id,obs2.id,activeV1.id]);
 await identity(one);
 canonicalRows=(await client.query(CANONICAL_BY_OBSERVATION,[obs2.id])).rows;
 legacyRows=(await client.query(LEGACY_BY_OBSERVATION,[obs2.id])).rows;
 if(canonicalRows.length!==1||canonicalRows[0].id!==snapActive.id)throw new Error('V4: canonical structured-current must still prefer the ACTIVE-binding snapshot over later raw recency');
 if(legacyRows.length!==1||legacyRows[0].id!==canonicalRows[0].id)throw new Error('V4: the compatibility surface must return exactly the canonical selection, never its own recency choice');
 if((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots WHERE id=$1',[lateSnapshot])).rows[0].n!==1)throw new Error('V4: the late retired-binding snapshot must remain durable');

 // === V5 - Non-Energy contamination rejection ============================
 // A real persisted non-Energy structured snapshot created through its own
 // approved metric-owned RPC - never a string fixture.
 const stressObs=(await client.query("SELECT * FROM public.create_hse_stress_measurement('CONVERSATION_SESSION',$1,'HIGH',NULL)",[session])).rows[0];
 const stressSnap=(await client.query('SELECT * FROM public.calculate_hse_stress_measurement($1)',[stressObs.id])).rows[0];
 if(stressSnap.metric_key!=='hse.stress')throw new Error('V5: the non-Energy fixture must be a real Stress snapshot');
 const stressCanonical=(await client.query(CANONICAL_BY_OBSERVATION,[stressObs.id])).rows;
 if(stressCanonical.length!==1||stressCanonical[0].id!==stressSnap.id)throw new Error('V5: the canonical shared current view must contain the Stress current snapshot');
 if((await client.query(LEGACY_BY_OBSERVATION,[stressObs.id])).rows.length!==0)throw new Error('V5: the Energy compatibility surface must return zero rows for a non-Energy observation');
 const contamination=(await client.query(`SELECT count(*)::int n FROM ${LEGACY} WHERE metric_key<>'hse.energy' OR definition_version<>1`)).rows[0].n;
 if(contamination!==0)throw new Error('V5: the Energy compatibility surface leaked a non-Energy or non-v1 row');
 if(await parityDrift()!==0)throw new Error('V5: compatibility/canonical set parity broke once a non-Energy metric was present');

 // === V6 - Correction-gap semantics remain compatible ====================
 const obs3=(await client.query("SELECT * FROM public.create_hse_energy_measurement($1,'MODERATE',NULL)",[session])).rows[0];
 const snap3=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[obs3.id])).rows[0];
 if((await client.query(LEGACY_BY_EVENT,[obs3.measurement_event_id])).rows[0]?.id!==snap3.id)throw new Error('V6: the compatibility surface must expose the calculated original Energy snapshot');
 const correction=(await client.query("SELECT * FROM public.correct_hse_energy_measurement($1,'VERY_HIGH',NULL)",[obs3.id])).rows[0];
 const gapLegacy=(await client.query(LEGACY_BY_EVENT,[obs3.measurement_event_id])).rows;
 const gapCanonical=(await client.query(CANONICAL_BY_EVENT,[obs3.measurement_event_id])).rows;
 if(gapLegacy.length!==0||gapCanonical.length!==0)throw new Error('V6: between correction and replacement calculation neither surface may expose a current Energy snapshot for the superseded observation');
 const correctedSnap=(await client.query('SELECT * FROM public.calculate_hse_energy_measurement($1)',[correction.id])).rows[0];
 const afterLegacy=(await client.query(LEGACY_BY_EVENT,[obs3.measurement_event_id])).rows;
 const afterCanonical=(await client.query(CANONICAL_BY_EVENT,[obs3.measurement_event_id])).rows;
 if(afterLegacy.length!==1||afterCanonical.length!==1||afterLegacy[0].id!==correctedSnap.id||afterLegacy[0].id!==afterCanonical[0].id||afterLegacy[0].numeric_value!==5)throw new Error('V6: after the correction is calculated both surfaces must agree on exactly the corrected snapshot');
 if((await client.query('SELECT count(*)::int n FROM public.him_metric_snapshots WHERE id=$1',[snap3.id])).rows[0].n!==1)throw new Error('V6: the corrected observation history must stay durable and non-destructive');
 // Inherited cardinality: the compatibility surface can never expose more than
 // one current snapshot per unsuperseded observation, because it never selects.
 const cardinality=(await client.query(`SELECT coalesce(max(n),0)::int mx FROM(SELECT count(*) n FROM ${LEGACY} GROUP BY measurement_observation_id)g`)).rows[0].mx;
 if(cardinality>1)throw new Error('V6: the compatibility surface exposed more than one current snapshot for one observation');

 // === V7 - Cross-user isolation ==========================================
 // End-user evidence only: both reads run as a second real authenticated
 // identity, never through a privileged connection.
 await client.query('RESET ROLE');await identity(two);
 if((await client.query(`SELECT count(*)::int n FROM ${CANONICAL}`)).rows[0].n!==0)throw new Error('V7: user B must not read user A rows through the canonical structured-current surface');
 if((await client.query(`SELECT count(*)::int n FROM ${LEGACY}`)).rows[0].n!==0)throw new Error('V7: user B must not read user A Energy rows through the compatibility surface');
 if((await client.query(LEGACY_BY_OBSERVATION,[obs1.id])).rows.length!==0)throw new Error('V7: user B must not read a named user A Energy observation through the compatibility surface');

 // === V8 - Exact v1 compatibility boundary ===============================
 // Future hse.energy@2 stays legal: a later Energy definition version can be
 // created here and nothing in this task forbids it. What the reconciliation
 // guarantees is only that this versionless legacy surface is pinned to v1 -
 // while the canonical authority it projects carries no definition-version
 // restriction at all and would legitimately carry a future version.
 if(/definition_version\s*=\s*\d/.test(canonicalDef))throw new Error('V8: the canonical structured-current authority must stay version-agnostic - the v1 pin belongs only to the legacy compatibility surface');
 await client.query('RESET ROLE');
 const futureVersion=(await client.query("SELECT max(definition_version)::int+1 v FROM public.him_metric_definitions WHERE metric_key='hse.energy'")).rows[0].v;
 await client.query("INSERT INTO public.him_metric_definitions SELECT (jsonb_populate_record(NULL::public.him_metric_definitions,to_jsonb(d)||jsonb_build_object('definition_version',$1::integer))).* FROM public.him_metric_definitions d WHERE d.metric_key='hse.energy' AND d.definition_version=1",[futureVersion]);
 if((await client.query("SELECT count(*)::int n FROM public.him_metric_definitions WHERE metric_key='hse.energy' AND definition_version=$1",[futureVersion])).rows[0].n!==1)throw new Error('V8: a future Energy definition version must remain legal to create');
 await identity(one);
 if((await client.query(`SELECT count(*)::int n FROM ${LEGACY} WHERE definition_version<>1`)).rows[0].n!==0)throw new Error('V8: the legacy compatibility surface must never expose a non-v1 Energy row');
 if(await parityDrift()!==0)throw new Error('V8: compatibility/canonical Energy v1 parity broke once a later Energy definition version existed');

 await client.query('ROLLBACK');
 // === Complete fixture rollback ==========================================
 const residue=(await client.query("SELECT (SELECT count(*) FROM public.him_canonical_model_bindings WHERE id::text LIKE '53000000-%')+(SELECT count(*) FROM public.him_calculation_models WHERE id::text LIKE '53000000-%')+(SELECT count(*) FROM public.him_governance_approvals WHERE id::text LIKE '53000000-%')+(SELECT count(*) FROM public.him_calculation_results WHERE id::text LIKE '53000000-%')+(SELECT count(*) FROM public.him_metric_snapshots WHERE id::text LIKE '53000000-%') total")).rows[0].total;
 if(Number(residue)!==0)throw new Error('QHIM-012 verifier fixtures must roll back completely');
 if(await energyVersions()!==baselineEnergyVersions)throw new Error('The synthetic future Energy definition version must roll back to the captured baseline inventory');
 if((await client.query('SELECT status FROM public.him_canonical_model_bindings WHERE id=$1',[activeV1.id])).rows[0].status!=='ACTIVE')throw new Error('The canonical Energy v1 binding must remain ACTIVE after fixture rollback');
}finally{await cleanupVerifierUsers(client,[one,two]);await client.end();}
console.log('Verified HIM Legacy Energy Current Authority Reconciliation v1 (QHIM-012): the installed public.him_current_energy_measurements is a security_invoker backward-compatibility projection over public.him_current_structured_measurements pinned to exactly hse.energy@1 with the him_metric_snapshots-compatible row shape, no raw snapshot join, no independent correction, supersession, binding, DISTINCT ON, snapshot-ordering or latest-selection algorithm, and only the intended authenticated read grant (PUBLIC, anon, and any new service_role authority excluded); ordinary Energy v1 measurement, a real protected canonical binding transition with append-only dual-binding history, and the 0050 race-ordering condition where a retired-binding snapshot carries later durable snapshot chronology all return exactly the one same snapshot through both surfaces with ACTIVE-binding preference inherited by delegation; a real persisted Stress snapshot is visible in the canonical shared current view and never leaks through the Energy surface; correction-gap semantics are preserved with no history deletion; a second authenticated identity reads nothing through either surface; and a legitimate future hse.energy@2 definition remains creatable while being unable to enter this versionless legacy v1 surface, whose delegated authority stays version-agnostic and whose latest-across-events counterpart public.read_him_latest_measurement_v1 is untouched. Every fixture rolled back completely.');
