import test from'node:test';import assert from'node:assert/strict';import{readdirSync,readFileSync}from'node:fs';
// QHIA-011 static contract. Freezes the 0060 migration's OWN authority
// contract: exactly TWO new read-only, non-SECURITY-DEFINER, authenticated-only
// functions -
//
//   * one direct Relationship-Communication foreground authority that resolves
//     relevance ONLY through the QHIA-006 authority and current intelligence
//     ONLY through the QHIA-004 authority, pinned to exactly RELATIONSHIP +
//     hrs.communication@1, never reading a protected HIM substrate, never
//     naming another context kind, never naming another metric (the three
//     sibling HRS metrics of that very context kind included, which is what
//     keeps Relationship Trust, Repair and Emotional Safety dormant), never
//     naming or inventing a Foundation semantic type, and never exposing a
//     caller-selected selector;
//   * one aggregate transport v3 that EXTENDS the frozen migration-0059
//     aggregate v2 with exactly one new slot by WRAPPING it, never by
//     reimplementing the three slots it already owns, never by calling the
//     0056/0057/0059 per-channel authorities, the frozen v1 aggregate, or the
//     lower QHIA-006/QHIA-004 authorities around it, and never by combining,
//     scoring, ranking, or correlating the four channels it transports.
//
// The frozen migration-0058 aggregate v1 and migration-0059 aggregate v2 are
// neither replaced, altered, nor weakened here: this contract proves 0060
// leaves them a two-slot and a three-slot contract.
//
// Forward-safe under the QHIM-002 policy: nothing here forbids a later
// migration, a later separately reviewed consumer, a later activation task, a
// later resolution of the HRS semantic mapping, or a later fifth slot in a
// later version. Every assertion runs against the 0060 migration text itself
// (or this task's own wiring), never against the global schema or function
// namespace.
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const MIGRATION='0060_him_relationship_communication_foreground_consumption_v1.sql';
const MIGRATION_NUMBER=Number(MIGRATION.slice(0,4));
// Computed rather than written literally, so this contract can name "the next
// migration number" as a thing it must NOT freeze without itself containing it.
const NEXT_MIGRATION_NUMBER=String(MIGRATION_NUMBER+1).padStart(4,'0');
const sql=read(`migrations/${MIGRATION}`);
const verifier=read('verify-migration-0060.mjs');
// Every negative rule runs against executable SQL only: prose comments may
// legitimately name a concept while documenting its absence.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
// The migration's own postconditions name forbidden authority, substrate,
// context, metric, semantic-type, and selector identifiers as DATA to prove
// their absence from the installed definitions; the isolation negatives
// therefore run on the slice BEFORE the first of them.
const postconditionStart=executable.indexOf('DO $$DECLARE fn text');
assert.ok(postconditionStart>0,'the migration carries its installed-definition postconditions');
const authoritySlice=executable.slice(0,postconditionStart);

const RELATIONSHIP_SIGNATURE='public.read_him_session_relationship_communication_v1(uuid,uuid)';
const V3_SIGNATURE='public.read_him_session_cross_context_foreground_v3(uuid,uuid)';

// The single guard the anti-vacuity fixtures below drive. It receives one
// comment-stripped migration text and throws on the first violated
// architectural property, so "the guard catches drift X" is proven by running
// the real guard over a mutated text - never by re-deriving the expectation.
const REQUIRED=[
 [/CREATE FUNCTION public\.read_him_session_relationship_communication_v1\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter Relationship-communication signature'],
 [/CREATE FUNCTION public\.read_him_session_cross_context_foreground_v3\(p_user_id uuid,p_session_id uuid\)/,'the exact narrow two-parameter aggregate v3 signature'],
 [/LANGUAGE plpgsql STABLE SET search_path=''/,'the Relationship-communication authority is a STABLE plpgsql function with a fixed empty search_path'],
 [/LANGUAGE sql STABLE SET search_path=''/,'the aggregate v3 is a single-statement STABLE SQL function with a fixed empty search_path'],
 [/FROM public\.read_him_session_context_bindings_v1\(p_user_id,p_session_id\) b/,'relevance is delegated to the QHIA-006 authority, never reimplemented'],
 [/WHERE b\.context_kind='RELATIONSHIP'/,'exactly the ACTIVE RELATIONSHIP relevance binding is consumed'],
 [/'NO_ACTIVE_RELATIONSHIP'::text/,'an unbound session gets the deterministic no-effect answer'],
 [/'ACTIVE_RELATIONSHIP_BOUND'::text/,'a bound Relationship is reported as authoritatively bound'],
 [/Ambiguous ACTIVE Relationship relevance binding/,'more than one ACTIVE Relationship binding is a fail-closed integrity breach'],
 [/FROM public\.read_him_contextual_current_intelligence_batch_v1\(p_user_id,'RELATIONSHIP',bound_relationship::text,ARRAY\['hrs\.communication'\],ARRAY\[1\]\) c/,'current intelligence is delegated to the QHIA-004 authority for exactly RELATIONSHIP + hrs.communication@1'],
 [/SELECT a\.foreground_slot_order,a\.foreground_slot,/,'aggregate v3 carries the frozen v2 transport discriminator verbatim'],
 [/FROM public\.read_him_session_cross_context_foreground_v2\(p_user_id,p_session_id\) a/,'aggregate v3 wraps the frozen QHIA-010 aggregate v2, never reimplements its three slots'],
 [/SELECT 4::integer,'RELATIONSHIP_COMMUNICATION'::text,/,'the one new frozen transport slot is 4/RELATIONSHIP_COMMUNICATION'],
 [/FROM public\.read_him_session_relationship_communication_v1\(p_user_id,p_session_id\) r/,'aggregate v3 wraps the new direct Relationship-communication authority'],
 [/UNION ALL/,'the channels are transported side by side, never merged'],
 [/\) envelope ORDER BY envelope\.foreground_slot_order/,'the transport order is deterministic'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_relationship_communication_v1\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege on the Relationship authority is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_relationship_communication_v1\(uuid,uuid\) TO authenticated;/,'authenticated is the only Relationship-authority EXECUTE grantee'],
 [/REVOKE ALL ON FUNCTION public\.read_him_session_cross_context_foreground_v3\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role;/,'every default privilege on the aggregate v3 is revoked first'],
 [/GRANT EXECUTE ON FUNCTION public\.read_him_session_cross_context_foreground_v3\(uuid,uuid\) TO authenticated;/,'authenticated is the only aggregate-v3 EXECUTE grantee'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION 'The Relationship-communication composition must hold no privilege of its own/,'the postcondition proves the Relationship authority holds no privilege of its own'],
 [/IF p\.prosecdef THEN RAISE EXCEPTION 'The aggregate v3 must hold no privilege of its own/,'the postcondition proves the aggregate v3 holds no privilege of its own'],
 [/position\('public\.read_him_session_context_bindings_v1\(' in def\)=0/,'the postcondition proves QHIA-006 delegation on the INSTALLED Relationship definition'],
 [/position\('public\.read_him_contextual_current_intelligence_batch_v1\(' in def\)=0/,'the postcondition proves QHIA-004 delegation on the INSTALLED Relationship definition'],
 [/position\('''RELATIONSHIP''' in def\)=0 OR position\('''hrs\.communication''' in def\)=0/,'the postcondition proves the exact RELATIONSHIP + hrs.communication pinning on the INSTALLED definition'],
 [/'''SITUATION''','''DECISION''','''GOAL''','''CONVERSATION_SESSION''','''GLOBAL''','hrs\.relationship-trust','hrs\.repair','hrs\.emotional-safety','hse\.','hbs\.','hgs\.'/,'the postcondition proves the three sibling HRS metrics and every other context and metric absent from the INSTALLED Relationship definition'],
 [/'''COMMUNICATION''','''STATE''','''TRAIT''','''CAPABILITY''','''READINESS''','''LOAD''','''PROGRESS''','''ALIGNMENT''','''UNCERTAINTY''','''SAFETY''','''RESOLVED'''/,'the postcondition proves no Foundation semantic type is named or invented by the INSTALLED Relationship definition'],
 [/QHIA-011 invents no Foundation semantic mapping/,'the semantic-mapping non-invention rule is enforced on the installed definition'],
 [/position\('public\.read_him_session_cross_context_foreground_v2\(' in def\)=0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the frozen QHIA-010 aggregate v2/,'the postcondition proves v2 wrapping on the INSTALLED v3 definition'],
 [/position\('public\.read_him_session_relationship_communication_v1\(' in def\)=0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the QHIA-011 Relationship-communication/,'the postcondition proves Relationship-authority wrapping on the INSTALLED v3 definition'],
 [/position\('''RELATIONSHIP_COMMUNICATION''' in def\)=0 THEN RAISE EXCEPTION/,'the postcondition proves the new frozen slot label on the INSTALLED v3 definition'],
 [/replace\(def,'UNION ALL',''\)\)\)\/length\('UNION ALL'\)<>1/,'the postcondition proves exactly one added transport slot on the INSTALLED v3 definition'],
 [/'public\.read_him_session_situation_stress_v1','public\.read_him_session_decision_attention_v1','public\.read_him_session_goal_motivation_v1','public\.read_him_session_cross_context_foreground_v1','public\.read_him_session_context_bindings_v1','public\.read_him_contextual_current_intelligence_batch_v1'/,'the postcondition proves the per-channel 0056/0057/0059 authorities, the frozen v1 aggregate, and the lower QHIA-006/QHIA-004 authorities are absent from the INSTALLED v3 definition'],
 [/The QHIA-009 cross-context foreground aggregate v1 \(migration 0058\) must remain installed/,'the frozen aggregate v1 must remain installed'],
 [/The QHIA-010 cross-context foreground aggregate v2 \(migration 0059\) must remain installed/,'the frozen aggregate v2 must remain installed'],
 [/The QHIA-009 aggregate v1 must keep its unchanged authenticated-only EXECUTE authority/,'the frozen aggregate v1 keeps its unchanged narrow ACL'],
 [/The QHIA-010 aggregate v2 must keep its unchanged authenticated-only EXECUTE authority/,'the frozen aggregate v2 keeps its unchanged narrow ACL'],
 [/The QHIA-009 aggregate v1 must keep its exact two-slot contract/,'the frozen aggregate v1 keeps its exact two-slot contract'],
 [/The QHIA-010 aggregate v2 must keep its exact three-slot contract/,'the frozen aggregate v2 keeps its exact three-slot contract'],
 [/The QHIA-010 aggregate v2 must remain a three-slot contract: the fourth slot belongs to v3 only/,'the fourth slot is proven absent from the frozen aggregate v2'],
 [/The QHIA-007 Situation-stress authority \(migration 0056\) must remain installed/,'the QHIA-007 authority must remain installed'],
 [/The QHIA-008 Decision-attention authority \(migration 0057\) must remain installed/,'the QHIA-008 authority must remain installed'],
 [/The QHIA-010 Goal-motivation authority \(migration 0059\) must remain installed/,'the QHIA-010 authority must remain installed'],
];
const FORBIDDEN=[
 [/SECURITY DEFINER/,'neither new function holds a privilege of its own: every privileged read belongs to the composed authorities'],
 [/CREATE (OR REPLACE )?(TABLE|VIEW|TRIGGER|POLICY|ROLE|SCHEMA|EXTENSION|INDEX)/,'no table, view, trigger, policy, role, schema, extension, or index is created'],
 [/CREATE OR REPLACE FUNCTION/,'no existing function is replaced: 0054, 0055, 0056, 0057, 0058 and 0059 are composed, wrapped, or left alone, never rewritten'],
 [/GRANT[^;]*\b(anon|PUBLIC|service_role)\b/,'anon, PUBLIC, and service_role are granted nothing'],
 [/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s/i,'no direct table privilege is granted to anyone'],
 [/him_metric_definitions\s+SET|semantic_mapping_status\s*=\s*'RESOLVED'|semantic_type\s*=\s*'/,'the Foundation semantic mapping of hrs.communication@1 is never resolved, upgraded, or invented'],
];
// Negatives that must hold on the AUTHORITY slice only, because the
// postconditions name these identifiers as data to prove their absence from the
// installed definitions.
const FORBIDDEN_IN_AUTHORITY=[
 [/'SITUATION'|'DECISION'|'GOAL'|'CONVERSATION_SESSION'|'GLOBAL'/,'QHIA-011 activates exactly RELATIONSHIP: no other context kind is named'],
 [/hse\.|hbs\.|hgs\.|hrs\.relationship-trust|hrs\.repair|hrs\.emotional-safety/,'QHIA-011 activates exactly hrs.communication@1: the three sibling HRS metrics stay dormant and no other metric is named'],
 [/'COMMUNICATION'|'STATE'|'TRAIT'|'CAPABILITY'|'READINESS'|'LOAD'|'PROGRESS'|'ALIGNMENT'|'UNCERTAINTY'|'RESOLVED'|'UNRESOLVED'/,'QHIA-011 invents, asserts, and resolves no Foundation semantic mapping'],
 [/read_him_session_situation_stress_v1|read_him_session_decision_attention_v1|read_him_session_goal_motivation_v1/,'the QHIA-007, QHIA-008 and QHIA-010 per-channel authorities stay owned by the frozen v2 aggregate, never called around it'],
 [/read_him_session_cross_context_foreground_v1/,'the frozen QHIA-009 aggregate v1 stays owned by the v2 aggregate, never called around it'],
 [/read_him_latest_measurement_v1|him_active_structured_binding_id/,'canonical-latest and ACTIVE-binding authority stay delegated, never called directly'],
 [/public\.him_session_context_bindings\b/,'the QHIA-006 binding substrate is never queried directly'],
 [/public\.him_measurement_targets|public\.conversation_sessions|public\.him_metric_definitions|public\.him_metric_snapshots|public\.him_measurement_events|public\.him_measurement_observations|public\.him_current_structured_measurements|public\.him_canonical_model_bindings|public\.him_calculation_results/,'no ownership, definition, measurement, or binding substrate is read directly'],
 [/auth\.uid\(\)/,'authentication is never re-implemented: it belongs to the composed authorities'],
 [/p_context_kind|p_context_id|p_metric_key|p_metric_keys|p_definition_version|p_target|p_slot|p_relationship|p_label|p_display/,'no caller-selected context, target, metric, relationship, or slot selector exists on either callable surface'],
 [/composite|_score\b|\brank\b|\bpriority\b|\bweight\b|correlat/i,'the channels are never combined, scored, ranked, weighted, or correlated'],
 [/LIMIT\s+1/i,'no newest/first/only-Relationship fallback exists'],
 [/ORDER\s+BY[^;]*created_at/i,'creation recency never becomes relevance or transport order'],
 [/embedding|similarity|classif|semantic_match|vector|openai|anthropic|\bllm\b|\bprompt\b|free[_-]?text|display_text|target_label|social|contact/i,'no provider, model, embedding, classifier, label-matching, social-graph, or free-text relevance logic exists'],
 [/confidence_score|relevance_score|relevance_weight|readiness|diagnos|valence|severity|health|abuse|danger|trust\b|repair\b/i,'no score, weight, readiness, diagnosis, valence, severity, relationship-health, safety, trust, or repair semantics exist'],
 [/EXECUTE\s+format|EXECUTE\s+'/i,'no dynamic SQL exists'],
 [/INSERT\s+INTO/i,'the migration writes no row'],
 [/UPDATE\s+public\./i,'the migration mutates no row'],
 [/DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|FUNCTION|VIEW|CONSTRAINT|TRIGGER|POLICY)/i,'the migration deletes and drops nothing'],
 [/ALTER\s+TABLE/i,'no table gains a column, constraint, trigger, or policy'],
 [/request\.jwt|set_config/,'no request identity is reconstructed or written'],
];
function assertRelationshipCommunicationForegroundContract(text){
 const start=text.indexOf('DO $$DECLARE fn text');
 const authority=start>0?text.slice(0,start):text;
 for(const[pattern,property]of REQUIRED)if(!pattern.test(text))throw new Error(`QHIA-011 Relationship-communication foreground contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN)if(pattern.test(text))throw new Error(`QHIA-011 Relationship-communication foreground contract violated: ${property}`);
 for(const[pattern,property]of FORBIDDEN_IN_AUTHORITY)if(pattern.test(authority))throw new Error(`QHIA-011 Relationship-communication foreground contract violated: ${property}`);
 // Cardinality rules the regex lists cannot express: EXACTLY one delegation per
 // composed authority, EXACTLY one new transport slot, EXACTLY one activated
 // context kind and metric.
 const counts=[
  [/UNION ALL/g,1,'aggregate v3 extends the frozen v2 envelope with exactly one new slot: no fifth slot and no read-all fan-out'],
  [/'RELATIONSHIP_COMMUNICATION'/g,1,'the RELATIONSHIP_COMMUNICATION slot is labelled exactly once'],
  [/'RELATIONSHIP'/g,2,'exactly the RELATIONSHIP relevance filter and the RELATIONSHIP delegated read name the activated context kind'],
  [/'hrs\.communication'/g,1,'exactly one metric identity is activated'],
  [/FROM public\.read_him_session_context_bindings_v1\(/g,1,'the QHIA-006 relevance authority is called exactly once'],
  [/FROM public\.read_him_contextual_current_intelligence_batch_v1\(/g,1,'the QHIA-004 current-intelligence authority is called exactly once'],
  [/FROM public\.read_him_session_cross_context_foreground_v2\(/g,1,'the frozen aggregate v2 is wrapped exactly once'],
  [/FROM public\.read_him_session_relationship_communication_v1\(/g,1,'the direct Relationship authority is wrapped exactly once'],
  [/CREATE FUNCTION/g,2,'exactly two new functions are created'],
 ];
 for(const[pattern,expected,property]of counts){
  if((authority.match(pattern)??[]).length!==expected)throw new Error(`QHIA-011 Relationship-communication foreground contract violated: ${property}`);
 }
}
// The migration-identity rules, factored so forward-safety can be proven by
// running the real rules over a listing that already contains future
// migrations.
function assertMigrationIdentity(names){
 const migrations=[...names].sort();
 assert.ok(migrations.includes(MIGRATION),'migration 0060 exists');
 for(let n=1;n<=MIGRATION_NUMBER;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0059_him_goal_motivation_foreground_consumption_v1.sql'),'0060 orders after 0059');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0058_him_cross_context_foreground_aggregation_v1.sql'),'0060 orders after 0058');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0057_him_decision_attention_foreground_consumption_v1.sql'),'0060 orders after 0057');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0056_him_situation_stress_foreground_consumption_v1.sql'),'0060 orders after 0056');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0055_him_session_context_binding_relevance_v1.sql'),'0060 orders after 0055');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0054_him_contextual_current_intelligence_batch_read_v1.sql'),'0060 orders after 0054');
 assert.ok(migrations.indexOf(MIGRATION)>migrations.indexOf('0044_hrs_communication_repair_measurement_models_v1.sql'),'0060 orders after the 0044 Communication measurement model');
}

test('S1 - migration 0060 installs only the two narrow functions and satisfies the frozen contract',()=>{
 assertMigrationIdentity(readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql')));
 assert.doesNotThrow(()=>assertRelationshipCommunicationForegroundContract(executable),'the shipped migration satisfies the frozen contract');
 // Exactly the intended objects: two functions and nothing else - a count of
 // this migration's own text, never of the live namespace.
 assert.equal((executable.match(/CREATE FUNCTION/g)??[]).length,2,'exactly two new functions');
 assert.equal((executable.match(/CREATE /g)??[]).length,2,'the migration creates exactly two objects of any kind');
 assert.equal((executable.match(/GRANT EXECUTE/g)??[]).length,2,'exactly two EXECUTE grants');
 assert.equal((executable.match(/REVOKE ALL/g)??[]).length,2,'exactly two revocations');
 // Read-only by construction.
 assert.match(executable,/^BEGIN;/,'the migration is transactional');
 assert.match(executable,/COMMIT;\s*$/,'the migration commits');
});

test('S2 - hard authority rule: QHIA-006 + QHIA-004 are COMPOSED and the frozen aggregate v2 is WRAPPED, never reimplemented',()=>{
 // The composed authorities are required as preconditions, so the migration
 // cannot install against a schema that lacks any of them.
 assert.match(executable,/to_regprocedure\('public\.read_him_session_context_bindings_v1\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-006 relevance authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_contextual_current_intelligence_batch_v1\(uuid,text,text,text\[\],integer\[\]\)'\) IS NULL THEN RAISE EXCEPTION/,'the QHIA-004 batch authority is a hard precondition');
 assert.match(executable,/to_regprocedure\('public\.read_him_session_cross_context_foreground_v2\(uuid,uuid\)'\) IS NULL THEN RAISE EXCEPTION/,'the frozen QHIA-010 aggregate v2 is a hard precondition');
 // Not one rule of relevance resolution, exact target authority, canonical-
 // current selection, ACTIVE measurement-binding compatibility, session
 // ownership, or session runtime state is restated: all of them already live in
 // 0054/0055 and are reached only through delegation.
 assert.doesNotMatch(authoritySlice,/Authentication required|owner-exact|Unknown or cross-user|is not active|snapshot_version|supersedes_observation_id/,'no composed or lower authority rule is duplicated');
 // The aggregate v3 restates NONE of the three slots the frozen v2 already owns.
 assert.doesNotMatch(authoritySlice,/NO_ACTIVE_SITUATION|NO_ACTIVE_DECISION|NO_ACTIVE_GOAL|ACTIVE_SITUATION_BOUND|ACTIVE_DECISION_BOUND|ACTIVE_GOAL_BOUND|SITUATION_STRESS|DECISION_ATTENTION|GOAL_MOTIVATION/,'aggregate v3 reimplements no slot of the frozen v2 aggregate');
 // Transport shape only: the outer discriminator, then the nested authority row
 // verbatim, per channel.
 assert.equal((executable.match(/a\.binding_state,a\.binding_context_id,/g)??[]).length,1,'the wrapped v2 channels carry the nested authority rows verbatim');
 assert.equal((executable.match(/r\.binding_state,r\.binding_context_id,/g)??[]).length,1,'the Relationship channel carries the nested authority row verbatim');
 for(const column of['slot_order','metric_key','definition_version','hif_owner','semantic_mapping_status','semantic_type','calculation_status','valid_context_kinds','context_kind','context_id','has_canonical_current_value','source_metric_key','source_definition_version','source_semantic_mapping_status','source_semantic_type','source_context_kind','source_context_id','value_state','numeric_value','validity_status','confidence_state','confidence_reference','observed_at','temporal_window_start','temporal_window_end','canonical_binding_id','active_binding_id']){
  assert.ok(executable.includes(`c.${column}`),`the Relationship authority preserves the delegated ${column} verbatim`);
  assert.ok(executable.includes(`a.${column}`),`aggregate v3 preserves the wrapped v2 ${column} verbatim`);
  assert.ok(executable.includes(`r.${column}`),`aggregate v3 preserves the Relationship ${column} verbatim`);
 }
 // The postconditions prove the same absences on the INSTALLED definitions, so
 // a later CREATE OR REPLACE cannot silently regress them.
 assert.equal((executable.match(/position\(forbidden in def\)>0/g)??[]).length,6,'both installed definitions are proven free of every forbidden identifier class');
 assert.match(executable,/QHIA-011 activates exactly RELATIONSHIP \+ hrs\.communication@1/,'the postcondition proves exactly one context kind and one metric on the installed Relationship definition');
 assert.match(executable,/The aggregate v3 activates no metric and no context kind/,'the postcondition proves no metric and no context kind on the installed v3 definition');
 assert.match(executable,/The aggregate v3 accepts no caller-selected context, target, metric, or slot/,'the postcondition proves no caller-selected selector on the installed v3 definition');
 assert.equal((executable.match(/must be read-only/g)??[]).length,2,'both installed definitions are proven non-mutating');
});

test('S3 - anti-vacuity: the real guard rejects every named drift fixture',()=>{
 const drifts=[
  ['the Relationship authority read a protected substrate directly',executable.replace('FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b','FROM public.him_session_context_bindings b')],
  ['the Relationship authority called the canonical-latest authority around QHIA-004',executable.replace("FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'RELATIONSHIP',bound_relationship::text,ARRAY['hrs.communication'],ARRAY[1]) c","FROM public.read_him_latest_measurement_v1(p_user_id,'hrs.communication',1,'RELATIONSHIP',bound_relationship::text) c")],
  ['a sibling HRS metric was activated beside Communication',executable.replace("ARRAY['hrs.communication'],ARRAY[1]) c","ARRAY['hrs.communication','hrs.relationship-trust'],ARRAY[1,1]) c")],
  ['Relationship Trust was activated instead of Communication',executable.replace("ARRAY['hrs.communication'],ARRAY[1]) c","ARRAY['hrs.relationship-trust'],ARRAY[1]) c")],
  ['the relevance filter stopped naming the RELATIONSHIP kind',executable.replace("WHERE b.context_kind='RELATIONSHIP';",'WHERE true;')],
  ['a newest/only-Relationship fallback appeared',executable.replace("WHERE b.context_kind='RELATIONSHIP';","WHERE b.context_kind='RELATIONSHIP' LIMIT 1;")],
  ['creation recency became the relevance rule',executable.replace("WHERE b.context_kind='RELATIONSHIP';","WHERE b.context_kind='RELATIONSHIP' ORDER BY b.created_at DESC;")],
  ['relationship label matching became the relevance rule',executable.replace("WHERE b.context_kind='RELATIONSHIP';","WHERE b.context_kind='RELATIONSHIP' AND b.display_text IS NOT NULL;")],
  ['the Relationship callable surface gained a caller-supplied context id',executable.replace('CREATE FUNCTION public.read_him_session_relationship_communication_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_relationship_communication_v1(p_user_id uuid,p_session_id uuid,p_context_id uuid)')],
  ['the Relationship callable surface gained a caller-selected metric list',executable.replace('CREATE FUNCTION public.read_him_session_relationship_communication_v1(p_user_id uuid,p_session_id uuid)','CREATE FUNCTION public.read_him_session_relationship_communication_v1(p_user_id uuid,p_session_id uuid,p_metric_keys text[])')],
  ['the Relationship authority took privilege of its own',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''","LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''")],
  ['the Relationship authority lost its fixed search_path',executable.replace("LANGUAGE plpgsql STABLE SET search_path=''",'LANGUAGE plpgsql STABLE')],
  ['authentication was re-implemented instead of delegated',executable.replace('public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b','public.read_him_session_context_bindings_v1(auth.uid(),p_session_id) b')],
  ['the Foundation semantic mapping was resolved by this migration',executable.replace('COMMIT;',"UPDATE public.him_metric_definitions SET semantic_mapping_status='RESOLVED',semantic_type='STATE' WHERE metric_key='hrs.communication' AND definition_version=1;\nCOMMIT;")],
  ['the authority started asserting a semantic type of its own',executable.replace("RETURN QUERY SELECT 'ACTIVE_RELATIONSHIP_BOUND'::text,bound_relationship,","RETURN QUERY SELECT 'ACTIVE_RELATIONSHIP_BOUND'::text,bound_relationship,'STATE'::text,")],
  ['aggregate v3 reimplemented the QHIA-007 slot instead of wrapping v2',executable.replace('FROM public.read_him_session_cross_context_foreground_v2(p_user_id,p_session_id) a','FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) a')],
  ['aggregate v3 reimplemented the QHIA-010 slot instead of wrapping v2',executable.replace('FROM public.read_him_session_cross_context_foreground_v2(p_user_id,p_session_id) a','FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) a')],
  ['aggregate v3 reopened the frozen v1 aggregate instead of wrapping v2',executable.replace('FROM public.read_him_session_cross_context_foreground_v2(p_user_id,p_session_id) a','FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a')],
  ['aggregate v3 called the QHIA-006 relevance authority directly',executable.replace('FROM public.read_him_session_cross_context_foreground_v2(p_user_id,p_session_id) a','FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) a')],
  ['aggregate v3 called the QHIA-004 batch authority directly',executable.replace('FROM public.read_him_session_relationship_communication_v1(p_user_id,p_session_id) r','FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,p_session_id) r')],
  ['a fifth aggregate slot was added',executable.replace('  FROM public.read_him_session_relationship_communication_v1(p_user_id,p_session_id) r\n','  FROM public.read_him_session_relationship_communication_v1(p_user_id,p_session_id) r\n  UNION ALL\n  SELECT 5::integer,\'RELATIONSHIP_TRUST\'::text,r.binding_state,r.binding_context_id\n  FROM public.read_him_session_relationship_communication_v1(p_user_id,p_session_id) r\n')],
  ['the fourth slot was renumbered out of its frozen transport order',executable.replace("SELECT 4::integer,'RELATIONSHIP_COMMUNICATION'::text,","SELECT 1::integer,'RELATIONSHIP_COMMUNICATION'::text,")],
  ['the fourth slot label drifted',executable.replace("SELECT 4::integer,'RELATIONSHIP_COMMUNICATION'::text,","SELECT 4::integer,'RELATIONSHIP_COMMUNICATION_QUALITY'::text,")],
  ['the deterministic transport order was dropped',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope')],
  ['a first-slot-only fallback appeared in the aggregate',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order LIMIT 1')],
  ['the four channels were reduced to a composite',executable.replace('a.value_state,a.numeric_value,','a.value_state,(a.numeric_value+r.numeric_value) AS composite_score,')],
  ['the frozen aggregate v2 was replaced instead of extended',executable.replace('CREATE FUNCTION public.read_him_session_cross_context_foreground_v3','CREATE OR REPLACE FUNCTION public.read_him_session_cross_context_foreground_v3')],
  ['a service_role grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT EXECUTE ON FUNCTION '+V3_SIGNATURE+' TO service_role;')],
  ['a direct table grant appeared',executable.replace('TO authenticated;','TO authenticated;\nGRANT SELECT ON public.him_session_context_bindings TO authenticated;')],
  ['a mutation appeared in the read path',executable.replace(') envelope ORDER BY envelope.foreground_slot_order',') envelope ORDER BY envelope.foreground_slot_order;\n UPDATE public.him_session_context_bindings SET status=status')],
  ['the Relationship installed-definition privilege postcondition was weakened',executable.replace("IF p.prosecdef THEN RAISE EXCEPTION 'The Relationship-communication composition must hold no privilege of its own",'IF false THEN RAISE EXCEPTION \'x')],
  ['the aggregate-v3 slot-cardinality postcondition was removed',executable.replace("(length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1",'false')],
  ['the v2-wrapping postcondition was removed',executable.replace("position('public.read_him_session_cross_context_foreground_v2(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the frozen QHIA-010 aggregate v2",'false THEN RAISE EXCEPTION \'x')],
  ['the sibling-HRS dormancy postcondition was removed from the installed Relationship definition proof',executable.replace("'''SITUATION''','''DECISION''','''GOAL''','''CONVERSATION_SESSION''','''GLOBAL''','hrs.relationship-trust','hrs.repair','hrs.emotional-safety','hse.','hbs.','hgs.'","'''SITUATION''','''DECISION''','''GOAL''','''CONVERSATION_SESSION''','''GLOBAL''','hse.','hbs.','hgs.'")],
  ['the semantic-type non-invention postcondition was removed',executable.replace("'''COMMUNICATION''','''STATE''','''TRAIT''','''CAPABILITY''','''READINESS''','''LOAD''','''PROGRESS''','''ALIGNMENT''','''UNCERTAINTY''','''SAFETY''','''RESOLVED'''","'''SAFETY'''")],
  ['the frozen aggregate v2 lost its three-slot preservation proof',executable.replace('The QHIA-010 aggregate v2 must remain a three-slot contract: the fourth slot belongs to v3 only','x')],
  ['the frozen aggregate v1 lost its preservation proof',executable.replace('The QHIA-009 aggregate v1 must keep its exact two-slot contract','x')],
 ];
 for(const[label,mutated]of drifts){
  assert.notEqual(mutated,executable,`the "${label}" mutation actually replaced its source text`);
  assert.throws(()=>assertRelationshipCommunicationForegroundContract(mutated),/QHIA-011 Relationship-communication foreground contract violated/,`the guard rejects: ${label}`);
 }
 // Positive control and formatting-insensitivity: cosmetic whitespace never
 // fails the guard.
 assert.doesNotThrow(()=>assertRelationshipCommunicationForegroundContract(executable));
 const reformatted=executable.replace('BEGIN;','BEGIN;\n');
 assert.notEqual(reformatted,executable,'the cosmetic rewrite actually changed the text');
 assert.doesNotThrow(()=>assertRelationshipCommunicationForegroundContract(reformatted),'formatting alone never fails the guard');
});

test('S4 - the guard creates no future ceiling and weakens no prior verification',()=>{
 const listing=readdirSync(new URL('migrations/',root)).filter(name=>name.endsWith('.sql'));
 assert.doesNotThrow(()=>assertMigrationIdentity([...listing,`${NEXT_MIGRATION_NUMBER}_a_future_migration.sql`,'0099_a_much_later_migration.sql']),'future migrations are legal');
 assert.ok(!executable.includes(NEXT_MIGRATION_NUMBER),'0060 freezes no next-migration number');
 assert.ok(!verifier.includes(NEXT_MIGRATION_NUMBER),'the 0060 verifier freezes no next-migration number');
 for(const source of[executable,verifier]){
  assert.doesNotMatch(source,/(?:!==|===|<>|=)\s*17\b/,'no global metric count is frozen');
  assert.doesNotMatch(source,/is the last migration|can never exist|must never exist/i,'no permanent existence ceiling is stated');
 }
 // Neither artifact asserts that a FUTURE sibling HRS foreground authority is
 // absent from the live namespace: dormancy is proven against this migration's
 // own frozen text and its own installed definitions only.
 for(const sibling of['read_him_session_relationship_trust','read_him_session_repair','read_him_session_emotional_safety']){
  assert.ok(!executable.includes(sibling),`0060 asserts nothing about a future ${sibling} authority`);
  assert.ok(!verifier.includes(sibling),`the 0060 verifier asserts nothing about a future ${sibling} authority`);
 }
 // The prior tasks' own artifacts are preserved untouched.
 const files=readdirSync(root);
 for(const preserved of['verify-migration-0054.mjs','verify-migration-0055.mjs','verify-migration-0056.mjs','verify-migration-0057.mjs','verify-migration-0058.mjs','verify-migration-0059.mjs'])assert.ok(files.includes(preserved),`the ${preserved} verifier is preserved`);
 const contracts=readdirSync(new URL('tests/',root));
 for(const preserved of['him-session-context-binding-relevance-v1.test.mjs','him-situation-stress-foreground-consumption-v1.test.mjs','him-decision-attention-foreground-consumption-v1.test.mjs','him-cross-context-foreground-aggregation-v1.test.mjs','him-goal-motivation-foreground-consumption-v1.test.mjs','hrs-communication-repair-measurement-models-v1.test.mjs'])assert.ok(contracts.includes(preserved),`the ${preserved} contract is preserved`);
 for(const preserved of['0054_him_contextual_current_intelligence_batch_read_v1.sql','0055_him_session_context_binding_relevance_v1.sql','0056_him_situation_stress_foreground_consumption_v1.sql','0057_him_decision_attention_foreground_consumption_v1.sql','0058_him_cross_context_foreground_aggregation_v1.sql','0059_him_goal_motivation_foreground_consumption_v1.sql'])assert.ok(listing.includes(preserved),`migration ${preserved} is preserved`);
 // The wrapped migration texts themselves are byte-identical to what 0058 and
 // 0059 shipped: this task versions the transport and changes no prior
 // authority. The frozen v1 aggregate still declares exactly its own two slots,
 // the frozen v2 exactly its own three, and neither knows anything about a
 // fourth.
 const aggregateV1=read('migrations/0058_him_cross_context_foreground_aggregation_v1.sql');
 assert.ok(aggregateV1.includes('CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-009 aggregate v1 is untouched');
 assert.ok(aggregateV1.includes("'SITUATION_STRESS'::text AS foreground_slot")&&aggregateV1.includes("SELECT 2::integer,'DECISION_ATTENTION'::text,"),'the QHIA-009 aggregate v1 keeps its frozen two-slot envelope');
 assert.ok(!aggregateV1.includes('RELATIONSHIP_COMMUNICATION')&&!aggregateV1.includes('read_him_session_relationship_communication_v1'),'the QHIA-009 aggregate v1 gained no fourth slot');
 const aggregateV2=read('migrations/0059_him_goal_motivation_foreground_consumption_v1.sql');
 assert.ok(aggregateV2.includes('CREATE FUNCTION public.read_him_session_cross_context_foreground_v2(p_user_id uuid,p_session_id uuid)'),'the QHIA-010 aggregate v2 is untouched');
 assert.ok(aggregateV2.includes("SELECT 3::integer,'GOAL_MOTIVATION'::text,")&&aggregateV2.includes('FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a'),'the QHIA-010 aggregate v2 keeps its frozen three-slot envelope');
 assert.ok(!aggregateV2.includes('RELATIONSHIP_COMMUNICATION')&&!aggregateV2.includes('read_him_session_relationship_communication_v1'),'the QHIA-010 aggregate v2 gained no fourth slot');
 assert.ok(read('migrations/0056_him_situation_stress_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_situation_stress_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-007 authority is untouched');
 assert.ok(read('migrations/0057_him_decision_attention_foreground_consumption_v1.sql').includes('CREATE FUNCTION public.read_him_session_decision_attention_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-008 authority is untouched');
 assert.ok(aggregateV2.includes('CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid)'),'the QHIA-010 Goal authority is untouched');
 // The canonical Communication measurement model is untouched, and its
 // Foundation identity remains exactly the UNRESOLVED / NULL one migration 0010
 // seeded and migration 0044 calibrated.
 const seed=read('migrations/0010_initial_him_metrics_v1.sql');
 assert.ok(seed.includes("('hrs.communication',1,'Communication'"),'the canonical Communication definition seed is preserved');
 const seedLine=seed.split('\n').find(line=>line.startsWith("('hrs.communication',1,"));
 assert.ok(seedLine&&seedLine.includes("'HRS','UNRESOLVED',NULL,"),'the frozen Foundation identity of hrs.communication@1 is HRS / UNRESOLVED / NULL');
 const model=read('migrations/0044_hrs_communication_repair_measurement_models_v1.sql');
 assert.ok(model.includes("UPDATE public.him_metric_definitions SET calculation_status='CALIBRATED',scale_reference='hrs.communication.workability-5.v1'"),'the 0044 Communication calibration is untouched');
 assert.ok(!model.includes('read_him_session_relationship_communication_v1'),'0060 added nothing to the 0044 measurement model');
});

test('the 0060 verifier proves the required live-schema scenarios on a real connection and stays non-destructive',()=>{
 for(const proof of[
  'to_regprocedure','pg_get_functiondef','has_function_privilege','prosecdef','provolatile','pronargs','lanname','prosrc',
  'read_him_session_relationship_communication_v1','read_him_session_cross_context_foreground_v3','read_him_session_cross_context_foreground_v2','read_him_session_cross_context_foreground_v1',
  'read_him_session_situation_stress_v1','read_him_session_decision_attention_v1','read_him_session_goal_motivation_v1',
  'read_him_contextual_current_intelligence_batch_v1','read_him_latest_measurement_v1','him_active_structured_binding_id',
  'set_him_session_context_binding_v1','clear_him_session_context_binding_v1',
  'create_him_relationship_measurement_target_v1','create_him_stress_measurement_context','create_him_attention_measurement_context','create_him_motivation_measurement_target',
  'create_hrs_communication_measurement_v1','calculate_hrs_communication_measurement_v1',
  'create_hrs_relationship_trust_measurement_v1','create_hrs_repair_measurement_v1','create_hrs_emotional_safety_measurement_v1',
  'create_hse_stress_measurement','create_hse_attention_measurement','create_hse_motivation_measurement',
  'activate_him_canonical_model_binding',
  'RELATIONSHIP_COMMUNICATION','GOAL_MOTIVATION','SITUATION_STRESS','DECISION_ATTENTION','NO_ACTIVE_RELATIONSHIP','ACTIVE_RELATIONSHIP_BOUND','cleanupVerifierUsers',
 ])assert.ok(verifier.includes(proof),`the verifier exercises ${proof}`);
 assert.match(verifier,/SET LOCAL ROLE authenticated/,'authority evidence uses a real authenticated identity');
 assert.match(verifier,/SET LOCAL ROLE anon/,'anon exclusion is exercised');
 assert.match(verifier,/SET LOCAL ROLE service_role/,'service_role exclusion is exercised');
 assert.match(verifier,/new Client\(\{connectionString:process\.env\.DATABASE_URL\}\)/,'the verifier opens a real PostgreSQL connection');
 assert.match(verifier,/await client\.query\('ROLLBACK'\)/,'transactional fixtures roll back');
 // The core QHIA-011 claims are proven against the DIRECT authorities on live
 // rows, not merely asserted about the aggregate in isolation.
 assert.match(verifier,/must equal the aggregate-v2 payload verbatim/,'aggregate-v3/aggregate-v2 payload parity is proven fact for fact');
 assert.match(verifier,/must still equal the aggregate-v1 payload verbatim/,'aggregate-v2/aggregate-v1 payload parity is still proven fact for fact');
 assert.match(verifier,/must equal the direct Relationship authority payload verbatim/,'aggregate-v3/direct-Relationship payload parity is proven fact for fact');
 assert.match(verifier,/must always return exactly four rows/,'the frozen four-row envelope cardinality is proven on real rows');
 assert.match(verifier,/must carry no duplicate slot/,'duplicate-slot absence is proven on real rows');
 assert.match(verifier,/must never gain the fourth slot/,'the frozen aggregate v2 is proven to have gained no fourth slot on real rows');
 assert.match(verifier,/must never gain a later slot/,'the frozen aggregate v1 is proven to have gained no later slot on real rows');
 assert.match(verifier,/No other relevance kind may activate the Relationship slot/,'cross-kind substitution is proven impossible on real rows');
 assert.match(verifier,/must still be UNRESOLVED/,'the canonical UNRESOLVED semantic mapping is proven on real rows');
 assert.match(verifier,/must still be NULL: no semantic type is invented/,'the canonical NULL semantic type is proven on real rows');
 assert.match(verifier,/A sibling HRS metric must never substitute for Communication/,'sibling HRS dormancy is proven on real rows');
 assert.match(verifier,/must be independently readable and KNOWN on the bound Relationship/,'the sibling dormancy proof is non-vacuous: the excluded sibling readings really exist');
 assert.match(verifier,/A KNOWN Communication on another Relationship must never reach a session bound to this one/,'cross-relationship isolation is proven on real rows');
 assert.match(verifier,/the never-bound Relationship is measurable through the QHIA-004 authority/,'ownership without an explicit relevance binding is proven invisible and non-vacuous');
 assert.match(verifier,/incompatible ACTIVE measurement binding/,'the incompatible ACTIVE measurement-binding state is proven on real rows');
 assert.match(verifier,/must be exactly one statement/,'the one-statement, one-snapshot aggregate v3 posture is proven on the installed body');
 assert.match(verifier,/exactly HRS \/ UNRESOLVED \/ NULL \/ CALIBRATED/,'the canonical metric identity is proven unchanged after the whole verifier runs');
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings|UPDATE public\.him_metric_definitions/,'the verifier mutates no measurement history');
});

test('the 0060 verifier is wired after the 0059 aggregate verifier and before the downstream HIM consumption gates',()=>{
 const packageJson=JSON.parse(read('../package.json'));
 assert.match(packageJson.scripts['verify:him-relationship-communication-foreground-consumption:integration'],/--env-file-if-exists=\.env database\/verify-migration-0060\.mjs/);
 const ci=read('../.github/workflows/api-ci.yml');
 const step=ci.indexOf('verify:him-relationship-communication-foreground-consumption:integration');
 assert.ok(step>0,'CI runs the 0060 verifier');
 assert.ok(step>ci.indexOf('verify:him-goal-motivation-foreground-consumption:integration'),'it runs after the 0059 Goal-motivation verifier');
 assert.ok(step>ci.indexOf('verify:him-cross-context-foreground-aggregation:integration'),'it runs after the 0058 aggregate verifier');
 assert.ok(step>ci.indexOf('verify:him-decision-attention-foreground-consumption:integration'),'it runs after the 0057 Decision-attention verifier');
 assert.ok(step>ci.indexOf('verify:him-situation-stress-foreground-consumption:integration'),'it runs after the 0056 Situation-stress verifier');
 assert.ok(step>ci.indexOf('verify:him-session-context-binding:integration'),'it runs after the 0055 binding verifier');
 assert.ok(step>ci.indexOf('verify:him-contextual-current-intelligence-batch:integration'),'it runs after the 0054 batch verifier');
 assert.ok(step>ci.indexOf('verify:hrs-communication-repair:integration'),'it runs after the 0044 HRS Communication measurement-model verifier');
 assert.ok(step<ci.indexOf('verify:him-trends:integration'),'it runs before the HIM Trend check');
 assert.ok(step<ci.indexOf('verify:him-snapshot:integration'),'it runs before the HIM Snapshot check');
 assert.ok(step<ci.indexOf('verify:background-him-runtime-consumption:integration'),'it runs before the background HIM consumption check');
 assert.ok(step<ci.indexOf('verify:full-intelligence-e2e-runtime'),'it runs before the Full Intelligence end-to-end runtime smoke');
 for(const preserved of['verify:him-goal-motivation-foreground-consumption:integration','verify:him-cross-context-foreground-aggregation:integration','verify:him-decision-attention-foreground-consumption:integration','verify:him-situation-stress-foreground-consumption:integration','verify:him-session-context-binding:integration','verify:him-contextual-current-intelligence-batch:integration','verify:him-canonical-latest-measurement-read-semantics:integration','verify:him-structured-current-binding-transition-safety:integration','verify:hrs-communication-repair:integration','verify:hrs-relationship-trust:integration','verify:hrs-emotional-safety:integration','verify:him-trends:integration','verify:him-snapshot:integration','verify:background-him-runtime-consumption:integration'])assert.ok(ci.includes(preserved)&&packageJson.scripts[preserved],`the prior gate ${preserved} is preserved`);
});
