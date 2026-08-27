import pg from 'pg';const{Client}=pg;const client=new Client({connectionString:process.env.DATABASE_URL});
const one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
const rejects=async(sql,params=[])=>{let failed=false;await client.query('SAVEPOINT expected_rejection');try{await client.query(sql,params);}catch{failed=true;await client.query('ROLLBACK TO SAVEPOINT expected_rejection');}await client.query('RELEASE SAVEPOINT expected_rejection');if(!failed)throw new Error(`Expected rejection: ${sql}`);};
await client.connect();try{
 // The durable 0011 guarantee is the five canonical HSE v1 calibration
 // identities, so the read is scoped to definition_version=1 and to those
 // exact keys: a later legitimately reviewed hse.energy@2 is another Energy
 // definition, not a violation of this historical phase, and the global
 // uncalibrated population is deliberately not counted here.
 const HSE_V1=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress'];
 const calibration=await client.query("SELECT metric_key,calculation_status,scale_reference FROM public.him_metric_definitions WHERE definition_version=1 AND metric_key=ANY($1::text[])",[HSE_V1]);
 for(const key of HSE_V1){const definition=calibration.rows.find(x=>x.metric_key===key);if(!definition||definition.calculation_status!=='CALIBRATED'||definition.scale_reference!==`${key}.ordinal-5.v1`)throw new Error(`Canonical v1 calibration identity failed for ${key}`);}
 const grants=await client.query("SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee='authenticated' AND table_name IN ('him_calculation_models','him_calculation_results','him_calibration_evaluations') AND privilege_type<>'SELECT'");if(grants.rowCount)throw new Error('Authenticated role has HIM runtime write privilege');
 await client.query('BEGIN');await client.query("INSERT INTO auth.users(id) VALUES($1),($2) ON CONFLICT DO NOTHING",[one,two]);await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:one})]);
 await rejects("INSERT INTO public.him_calculation_models(id,model_id,model_version,target_metric_key,target_definition_version,lifecycle,environment,canonical_owner,canonical_source,method_type,scale_contract_reference,required_input_contract,required_evidence_contract,supported_context_kinds,missing_data_behavior,contradiction_behavior,confidence_contract,implementation_id,created_at,versioned_at) VALUES(gen_random_uuid(),'forged',1,'hse.stress',1,'CALIBRATED','PRODUCTION','forged','forged','forged','forged','{}','forged',ARRAY['SITUATION'],'UNASSESSED','UNASSESSED_PRESERVE_CONFLICT','UNRESOLVED_METRIC_CONFIDENCE','forged',now(),now())");
 const rows=await client.query('SELECT * FROM public.him_calibration_evaluations');if(rows.rowCount!==0)throw new Error('Unexpected calibration data');await client.query('ROLLBACK');
}finally{await client.end();}console.log('Verified HIM calculation/calibration PostgreSQL RLS, forgery resistance, and Energy/Motivation/Attention latest calibration state.');

