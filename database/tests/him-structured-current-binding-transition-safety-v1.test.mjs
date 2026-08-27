import test from'node:test';import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';
const sql=readFileSync(new URL('../migrations/0050_him_structured_current_binding_transition_safety_v1.sql',import.meta.url),'utf8');
// Negative assertions run against the executable SQL only: prose comments
// legitimately name the remediated defect states while documenting them.
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
const view=executable.slice(executable.indexOf('CREATE OR REPLACE VIEW public.him_current_structured_measurements'),executable.indexOf('DO $$'));
const CANONICAL=['hse.energy','hse.motivation','hse.attention','hse.self-confidence','hse.stress','hbs.avoidance','hbs.consistency','hbs.initiative','hbs.reflection','hrs.relationship-trust','hrs.communication','hrs.repair','hrs.emotional-safety','hgs.self-awareness','hgs.resilience','hgs.purpose-alignment','hgs.habit-strength'];

test('0050 exists exactly once, orders after 0049, and edits no prior migration',()=>{
 // Historical phase guarantee only: this contract owns migration 0050's
 // identity and ordering, never a permanent ceiling on later migrations -
 // future tasks may add further migrations, and nothing here (or in the
 // 0050 verifier) asserts that a later migration can never exist or that
 // 0050 is the last migration.
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.includes('0050_him_structured_current_binding_transition_safety_v1.sql'));
 assert.equal(migrations.filter(name=>name.startsWith('0050')).length,1,'exactly one migration 0050');
 assert.ok(migrations.indexOf('0050_him_structured_current_binding_transition_safety_v1.sql')>migrations.indexOf('0049_hgs_habit_strength_measurement_model_v1.sql'));
 // Every historical migration up to 0049 keeps exactly one owner file per
 // number: the remediation is one new migration, never an edit, renumber,
 // or duplicate of a prior one.
 for(let n=1;n<=49;n++){const prefix=String(n).padStart(4,'0');assert.equal(migrations.filter(name=>name.startsWith(prefix)).length,1,`exactly one migration ${prefix}`);}
 // The remediation is selection-only: no history deletion, no table or
 // constraint rewrite, no metric/model/scale/approval/vocabulary change,
 // and no touched historical artifact of any kind.
 assert.doesNotMatch(executable,/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|DROP TABLE|DROP CONSTRAINT|DROP VIEW|DROP FUNCTION|ALTER TABLE|DISABLE TRIGGER/i,'0050 deletes, rewrites, and disables nothing');
 assert.doesNotMatch(executable,/him_metric_definitions|him_scale_contracts|INSERT INTO public\.him_calculation_models|INSERT INTO public\.him_governance_approvals|INSERT INTO public\.him_canonical_model_bindings|response_code|approval_basis/,'0050 changes no metric definition, scale, instrument, model, approval, binding row, or response vocabulary');
});
test('freezes the one-current-snapshot-per-observation selection with ACTIVE-binding priority',()=>{
 // The final structured-current view still carries all seventeen current
 // canonical metric routes - none added, none removed, none broadened.
 assert.match(view,/ARRAY\['hse\.energy','hse\.motivation','hse\.attention','hse\.self-confidence','hse\.stress','hbs\.avoidance','hbs\.consistency','hbs\.initiative','hbs\.reflection','hrs\.relationship-trust','hrs\.communication','hrs\.repair','hrs\.emotional-safety','hgs\.self-awareness','hgs\.resilience','hgs\.purpose-alignment','hgs\.habit-strength'\]/);
 for(const key of CANONICAL)assert.equal((view.match(new RegExp(`'${key.replace('.','\\.')}'`,'g'))??[]).length,1,`exactly one ${key} route`);
 // Both historical eligibility filters survive byte-for-byte: observation
 // corrections and explicit calculation supersessions.
 assert.match(view,/NOT EXISTS\(SELECT 1 FROM public\.him_measurement_observations newer WHERE newer\.supersedes_observation_id=o\.id\)/);
 assert.match(view,/NOT EXISTS\(SELECT 1 FROM public\.him_energy_calculation_supersessions x WHERE x\.snapshot_id=s\.id\)/);
 // Selection is explicitly one row per observation.
 assert.match(view,/SELECT DISTINCT ON\(s\.measurement_observation_id\)s\.\*/);
 // The ACTIVE source binding receives priority over recency: the coalesced
 // ACTIVE-binding match is the first ORDER BY criterion after the
 // DISTINCT ON key, ahead of the deterministic historical fallback.
 assert.match(view,/ORDER BY s\.measurement_observation_id,coalesce\(s\.canonical_binding_id=public\.him_active_structured_binding_id\(o\.metric_key,o\.definition_version,o\.context_kind\),false\)DESC,s\.snapshot_version DESC,s\.created_at DESC,s\.id DESC/);
 assert.ok(view.indexOf('him_active_structured_binding_id')<view.indexOf('snapshot_version DESC'),'ACTIVE-binding priority orders ahead of the historical fallback');
 // The deterministic historical fallback exists: durable snapshot
 // chronology plus a stable tie-breaker - so a retired-binding chain stays
 // observable (one row) before a compatible recalculation exists.
 assert.match(view,/s\.snapshot_version DESC,s\.created_at DESC,s\.id DESC/);
 assert.match(view,/WITH\(security_invoker=true\)/);
 // The resolver is metric-agnostic (shared by all seventeen routes - no
 // metric-specific currentness semantics) and reads only the ACTIVE
 // binding id for one exact route.
 const resolver=executable.slice(executable.indexOf('CREATE FUNCTION public.him_active_structured_binding_id'),executable.indexOf('CREATE OR REPLACE VIEW'));
 assert.match(resolver,/status='ACTIVE'/);
 assert.match(resolver,/RETURNS uuid/);
 assert.match(resolver,/SECURITY DEFINER/);
 assert.match(resolver,/REVOKE ALL ON FUNCTION public\.him_active_structured_binding_id\(text,integer,text\) FROM PUBLIC,anon/);
 assert.match(resolver,/GRANT EXECUTE ON FUNCTION public\.him_active_structured_binding_id\(text,integer,text\) TO authenticated/);
 assert.doesNotMatch(resolver,/hse\.|hbs\.|hrs\.|hgs\./,'the resolver hard-codes no metric route');
});
test('adds no Trend/Snapshot eligibility and rewrites no consumption surface',()=>{
 // The frozen Trend v1 and Intelligence Snapshot v1 read surfaces are
 // untouched: 0050 redefines neither function and creates no new
 // consumption eligibility for any metric.
 assert.doesNotMatch(executable,/read_him_trend_source_v1|read_him_intelligence_snapshot_v1|read_him_intelligence_snapshot_core_v1|background_read_him_conversation_snapshot_v1|slots\(/);
 assert.doesNotMatch(executable,/CREATE OR REPLACE FUNCTION/,'0050 replaces no existing function');
 // Exactly one new function (the resolver) and exactly one view rebuild.
 assert.equal((executable.match(/CREATE FUNCTION/g)??[]).length,1);
 assert.equal((executable.match(/CREATE OR REPLACE VIEW/g)??[]).length,1);
 assert.doesNotMatch(executable,/openai|anthropic|llm|provider|http|safety_runtime|recommendation/i);
});
test('keeps the 0050 verifier and this contract forward-safe',()=>{
 const verifier=readFileSync(new URL('../verify-migration-0050.mjs',import.meta.url),'utf8');
 // The verifier proves durable guarantees only: no next-migration-number
 // ceiling, no permanent existence ceiling, no live-schema
 // function-universe absence check, and no frozen global calibrated
 // count - later migrations, metric versions, and separately reviewed
 // runtime functions stay possible.
 assert.doesNotMatch(verifier,/0051/,'the 0050 verifier asserts no next-migration-number ceiling');
 assert.doesNotMatch(verifier,/forever|can never exist|cannot exist/i,'the 0050 verifier states no permanent existence ceiling');
 assert.doesNotMatch(verifier,/to_regprocedure/i,'the 0050 verifier proves no live-schema function absence of any kind');
 assert.doesNotMatch(verifier,/<>17(?!\d)|!==17(?!\d)/,'the 0050 verifier freezes no global calibrated count');
 assert.doesNotMatch(verifier,/rowCount!==\d+ .*him_metric_definitions|FROM public\.him_metric_definitions/,'the 0050 verifier freezes no definition inventory');
 // The verifier exercises the real protected lifecycle and the shared
 // surfaces this remediation owns.
 for(const token of['activate_him_canonical_model_binding','him_active_structured_binding_id','him_current_structured_measurements','read_him_intelligence_snapshot_v1','pg_get_viewdef','cleanupVerifierUsers'])assert.ok(verifier.includes(token),`the verifier names ${token} exactly`);
 // No destructive cleanup: every fixture rolls back - the verifier never
 // deletes measurement history to satisfy an assertion.
 assert.doesNotMatch(verifier,/DELETE FROM public\.him_metric_snapshots|DELETE FROM public\.him_calculation_results|DELETE FROM public\.him_measurement_observations|DELETE FROM public\.him_canonical_model_bindings/,'the verifier deletes no measurement or binding history');
 // The CI wiring runs the new verifier after the 0049 metric verifier and
 // before the HIM Trend and Snapshot verifiers, through an npm script with
 // the standard CI-safe env-file flag.
 const packageJson=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 assert.match(packageJson.scripts['verify:him-structured-current-binding-transition-safety:integration'],/--env-file-if-exists=\.env database\/verify-migration-0050\.mjs/);
 const ci=readFileSync(new URL('../../.github/workflows/api-ci.yml',import.meta.url),'utf8');
 const position=ci.indexOf('verify:him-structured-current-binding-transition-safety:integration');
 assert.ok(position>0,'CI runs the 0050 verifier');
 assert.ok(position>ci.indexOf('verify:hgs-habit-strength:integration'),'the 0050 verifier runs after the 0049 verifier');
 assert.ok(position<ci.indexOf('verify:him-trends:integration'),'the 0050 verifier runs before the HIM Trend verifier');
 assert.ok(position<ci.indexOf('verify:him-snapshot:integration'),'the 0050 verifier runs before the HIM Snapshot verifier');
});
