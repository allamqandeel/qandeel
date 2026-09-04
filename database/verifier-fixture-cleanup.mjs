export async function cleanupVerifierUsers(client,userIds){
  try{await client.query('ROLLBACK');}catch{}
  try{
    await client.query('RESET ROLE');await client.query('BEGIN');
    await client.query("SET LOCAL session_replication_role='replica'");
    // The committed-CU substrate (T-03A1) and the Session Semantic Clock and
    // its delivery events (T-03A2) are user-scoped too, so a fixture user is
    // only fully removed when they go as well. Order follows the foreign keys;
    // replica mode is what makes the append-only triggers stand aside.
    for(const table of ['him_energy_calculation_supersessions','him_calibration_evaluations','him_metric_snapshots','him_calculation_results','him_measurement_observations','him_measurement_events','him_measurement_targets','conversation_unit_commit_events','conversation_units','conversation_unit_commit_batches','conversation_turns','session_semantic_clocks','conversation_sessions']) await client.query(`DELETE FROM public.${table} WHERE user_id=ANY($1::uuid[])`,[userIds]);
    await client.query('DELETE FROM public.users WHERE id=ANY($1::uuid[])',[userIds]);
    await client.query('DELETE FROM auth.users WHERE id=ANY($1::uuid[])',[userIds]);
    const residue=await client.query(`SELECT
      (SELECT count(*) FROM auth.users WHERE id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.users WHERE id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.him_measurement_events WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.him_measurement_observations WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.him_measurement_targets WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.him_calculation_results WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.him_metric_snapshots WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.session_semantic_clocks WHERE user_id=ANY($1::uuid[]))+
      (SELECT count(*) FROM public.conversation_unit_commit_events WHERE user_id=ANY($1::uuid[])) total`,[userIds]);
    if(Number(residue.rows[0].total)!==0)throw new Error('Verifier fixture cleanup postcondition failed.');
    await client.query('COMMIT');
  }catch(error){try{await client.query('ROLLBACK');}catch{}throw new Error('Verifier fixture cleanup failed; details were suppressed.',{cause:error});}
}
