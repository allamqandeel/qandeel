// PROD-RETRY-01 - the Data API retry-hazard guard (QAN-BL-PROD-06).
//
// PostgREST before v16.0 re-runs a request's whole transaction, without bound, when it fails with SQLSTATE 40001
// (and, through hasql-transaction 1.1+, 40P01). Migration 0150 answers the deterministic stale-state refusals with
// PT409 instead, which PostgREST never re-runs. This module answers, from the LIVE catalog, which of those SQLSTATEs
// each Data API entry point can let ESCAPE to PostgREST, from which raise, and which handler absorbs the rest.
//
// It is an analysis, not a list of names to excuse:
//
//   1. Every PL/pgSQL and SQL function in every non-system schema is lexed: comments are dropped; string, quoted
//      identifier and dollar-quoted literals stay whole, so a word inside a literal is never mistaken for code.
//   2. A PL/pgSQL body is parsed into its BEGIN ... EXCEPTION ... END blocks, CASE frames and handler clauses, so every
//      raise, call and DML site knows exactly which handlers protect it. A site inside a handler clause is protected
//      only by the blocks AROUND that block, as PL/pgSQL defines it.
//   3. A raise site is a RAISE whose ERRCODE, `RAISE SQLSTATE` or condition name is one of TRACKED. A handler clause
//      matches by SQLSTATE, by condition name (serialization_failure, deadlock_detected, the transaction_rollback
//      class) or OTHERS; the first matching clause wins. A matching clause ABSORBS the error unless it re-raises
//      (`RAISE;`). A re-raise guarded by public_authoring_private.classify_public_refusal_v1(SQLERRM) absorbs exactly
//      the messages that function classifies, and the guard evaluates that function LIVE for every such message.
//   4. Calls are schema-qualified references to a known function, or bare references to a `public` function; a write
//      (INSERT / UPDATE / DELETE) to a relation reaches every enabled trigger function on that relation. Escapes are
//      computed to a fixpoint over that graph.
//   5. An ENTRY POINT is a `public` function that anon, authenticated or service_role may EXECUTE: the only schema the
//      API's Data API reaches (it sends no Accept-Profile / Content-Profile).
//
// Findings it raises on its own (any of them fails the verifier unless the verifier discharges it with a proof):
//   CATCH_TRAP       a handler catches 40001 by name or SQLSTATE but not PT409, over a call that can raise PT409: the
//                    0150 substitution would silently turn its absorbed outcome into a failed transaction;
//   DYNAMIC_ERRCODE  a RAISE whose SQLSTATE is not a literal;
//   DYNAMIC_SQL      an EXECUTE, which hides its calls from this analysis;
//   ISOLATION        a function, role or database that raises the isolation level (the only way PostgreSQL itself
//                    would raise 40001 instead of an application RAISE).
import assert from 'node:assert/strict';

export const RETRYABLE = Object.freeze(['40001', '40P01']);
export const NON_RETRYABLE_STALE = 'PT409';
export const TRACKED = Object.freeze([...RETRYABLE, NON_RETRYABLE_STALE]);
const CONDITION_CODES = Object.freeze({
  serialization_failure: ['40001'],
  deadlock_detected: ['40P01'],
  transaction_rollback: ['40000', '40001', '40002', '40003', '40P01'],
});
/** The SQLSTATE a condition NAME raises (a class name raises its class code). */
const codeOfCondition = (name) => ({ serialization_failure: '40001', deadlock_detected: '40P01', transaction_rollback: '40000' })[name.toLowerCase()] ?? null;
const BLOCK_ENDERS = new Set(['IF', 'LOOP', 'CASE']);
const RAISE_LEVELS = new Set(['EXCEPTION', 'NOTICE', 'WARNING', 'INFO', 'LOG', 'DEBUG']);
const DML = new Set(['INSERT', 'UPDATE', 'DELETE']);

// ------------------------------------------------------------------ lexer
/** Tokens of a function body: words (upper-cased in `u`), literals, numbers and operators. Comments are dropped. */
export function lex(source) {
  const tokens = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    if (/\s/u.test(c)) { i += 1; continue; }
    if (c === '-' && source[i + 1] === '-') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (c === '/' && source[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (source[i] === '/' && source[i + 1] === '*') { depth += 1; i += 2; } else if (source[i] === '*' && source[i + 1] === '/') { depth -= 1; i += 2; } else i += 1;
      }
      continue;
    }
    if (c === "'" || ((c === 'E' || c === 'e') && source[i + 1] === "'" && !/[A-Za-z0-9_]/u.test(source[i - 1] ?? ''))) {
      const escapes = c !== "'";
      let j = escapes ? i + 2 : i + 1;
      let value = '';
      while (j < n) {
        if (escapes && source[j] === '\\') { value += source[j + 1]; j += 2; continue; }
        if (source[j] === "'") { if (source[j + 1] === "'") { value += "'"; j += 2; continue; } break; }
        value += source[j];
        j += 1;
      }
      tokens.push({ t: 'str', v: value, at: i });
      i = j + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let value = '';
      while (j < n) {
        if (source[j] === '"') { if (source[j + 1] === '"') { value += '"'; j += 2; continue; } break; }
        value += source[j];
        j += 1;
      }
      tokens.push({ t: 'word', v: value, u: value.toUpperCase(), quoted: true, at: i });
      i = j + 1;
      continue;
    }
    if (c === '$') {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(source.slice(i, i + 64));
      if (tag) {
        const close = source.indexOf(tag[0], i + tag[0].length);
        tokens.push({ t: 'str', v: source.slice(i + tag[0].length, close < 0 ? n : close), at: i });
        i = close < 0 ? n : close + tag[0].length;
        continue;
      }
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/u.exec(source.slice(i, i + 128));
    if (word) { tokens.push({ t: 'word', v: word[0], u: word[0].toUpperCase(), at: i }); i += word[0].length; continue; }
    const num = /^[0-9][0-9A-Za-z.]*/u.exec(source.slice(i, i + 64));
    if (num) { tokens.push({ t: 'num', v: num[0], at: i }); i += num[0].length; continue; }
    const two = source.slice(i, i + 2);
    if ([':=', '::', '<>', '!=', '>=', '<=', '||', '=>'].includes(two)) { tokens.push({ t: 'op', v: two, at: i }); i += 2; continue; }
    tokens.push({ t: 'op', v: c, at: i });
    i += 1;
  }
  return tokens;
}

export const isWord = (tok, word) => Boolean(tok) && tok.t === 'word' && !tok.quoted && tok.u === word;
const isOp = (tok, op) => Boolean(tok) && tok.t === 'op' && tok.v === op;

// ----------------------------------------------------------- block parser
/**
 * Parses the BEGIN / EXCEPTION / END structure of a PL/pgSQL body. `protectors(at)` lists, innermost first, the
 * blocks whose handlers protect token `at`: blocks that enclose it in their protected section (before EXCEPTION).
 */
export function parseBlocks(tokens) {
  const frames = [];
  const contexts = new Array(tokens.length);
  const stack = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    const prev = tokens[i - 1];
    if (isWord(tok, 'BEGIN')) {
      const frame = { kind: 'block', start: i, exceptionAt: null, clauses: [], end: null };
      frames.push(frame);
      stack.push(frame);
    } else if (isWord(tok, 'CASE')) {
      stack.push({ kind: 'case' });
    } else if (isWord(tok, 'END')) {
      const next = tokens[i + 1];
      if (next && next.t === 'word' && !next.quoted && BLOCK_ENDERS.has(next.u)) {
        if (next.u === 'CASE') assert.equal(stack.pop()?.kind, 'case', 'END CASE closes a CASE');
        contexts[i] = stack.slice();
        contexts[i + 1] = stack.slice();
        i += 1;
        continue;
      }
      const top = stack.pop();
      assert.ok(top, 'END without an open block');
      if (top.kind === 'block') {
        top.end = i;
        const last = top.clauses.at(-1);
        if (last) last.end = i;
      }
    } else if (isWord(tok, 'EXCEPTION') && !isWord(prev, 'RAISE')) {
      const top = stack.at(-1);
      assert.ok(top && top.kind === 'block' && top.exceptionAt === null, 'an EXCEPTION section opens only a block');
      top.exceptionAt = i;
    } else if (isWord(tok, 'WHEN')) {
      const top = stack.at(-1);
      if (top && top.kind === 'block' && top.exceptionAt !== null && (i === top.exceptionAt + 1 || isOp(prev, ';'))) {
        const conditions = [];
        let j = i + 1;
        while (j < tokens.length && !isWord(tokens[j], 'THEN')) {
          if (isWord(tokens[j], 'SQLSTATE')) { conditions.push(String(tokens[j + 1].v).toUpperCase()); j += 2; continue; }
          if (tokens[j].t === 'word' && !isWord(tokens[j], 'OR')) conditions.push(tokens[j].v.toLowerCase());
          j += 1;
        }
        const last = top.clauses.at(-1);
        if (last) last.end = i;
        top.clauses.push({ conditions, start: j + 1, end: null });
        for (let k = i; k <= j; k += 1) contexts[k] = stack.slice();
        i = j;
        continue;
      }
    }
    contexts[i] = stack.slice();
  }
  assert.equal(stack.length, 0, 'every block and CASE is closed');
  const protectors = (at) => {
    const out = [];
    const blocks = (contexts[at] ?? []).filter((f) => f.kind === 'block');
    for (let k = blocks.length - 1; k >= 0; k -= 1) {
      const frame = blocks[k];
      if (frame.clauses.length && frame.exceptionAt !== null && at < frame.exceptionAt) out.push(frame);
    }
    return out;
  };
  return { frames, protectors };
}

/** Does a handler condition list catch a SQLSTATE? */
export function conditionMatches(conditions, code) {
  return conditions.some((c) => c === 'others' || c.toUpperCase() === code || (CONDITION_CODES[c] ?? []).includes(code));
}
/** Does it catch it NAMED, i.e. by SQLSTATE or condition name rather than OTHERS? */
const namedMatch = (conditions, code) => conditions.some((c) => c.toUpperCase() === code || (CONDITION_CODES[c] ?? []).includes(code));

// ------------------------------------------------------------ site finder
/** Every RAISE statement: its SQLSTATE (null when unset), message literal, and whether the SQLSTATE is dynamic. */
export function raiseSites(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (!isWord(tokens[i], 'RAISE')) continue;
    let j = i + 1;
    while (j < tokens.length && !isOp(tokens[j], ';')) j += 1;
    const stmt = tokens.slice(i + 1, j);
    const site = { at: i, bare: stmt.length === 0, code: null, message: null, dynamic: false, level: 'EXCEPTION' };
    let k = 0;
    if (stmt[0]?.t === 'word' && RAISE_LEVELS.has(stmt[0].u)) { site.level = stmt[0].u; k = 1; }
    if (isWord(stmt[k], 'SQLSTATE') && stmt[k + 1]?.t === 'str') site.code = stmt[k + 1].v.toUpperCase();
    else if (stmt[k]?.t === 'word' && !isWord(stmt[k], 'USING') && codeOfCondition(stmt[k].v)) site.code = codeOfCondition(stmt[k].v);
    else if (stmt[k]?.t === 'str') site.message = stmt[k].v;
    for (let m = 0; m < stmt.length; m += 1) {
      if (isWord(stmt[m], 'ERRCODE') && isOp(stmt[m + 1], '=')) {
        if (stmt[m + 2]?.t === 'str') site.code = codeOfCondition(stmt[m + 2].v) ?? stmt[m + 2].v.toUpperCase();
        else site.dynamic = true;
      }
      if (isWord(stmt[m], 'MESSAGE') && isOp(stmt[m + 1], '=') && stmt[m + 2]?.t === 'str') site.message = stmt[m + 2].v;
    }
    if (!(site.level !== 'EXCEPTION' && site.code === null)) out.push(site);
    i = j;
  }
  return out;
}

// --------------------------------------------------------------- analysis
/** Loads the live catalog through `query(sql, params) -> rows` and computes every function's escape set. */
export async function analyseRetryHazard(query) {
  const fns = await query(`
    SELECT p.oid::int AS oid, n.nspname AS schema, p.proname AS name, p.oid::regprocedure::text AS signature,
           l.lanname AS language, p.prosrc, p.proconfig::text AS proconfig,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang
     WHERE l.lanname IN ('plpgsql', 'sql') AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND n.nspname NOT LIKE 'pg\\_%'
     ORDER BY p.oid`);
  const triggers = await query(`
    SELECT rn.nspname AS rel_schema, r.relname AS rel, t.tgfoid::int AS fn
      FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace rn ON rn.oid = r.relnamespace
     WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'`);
  // regprocedure text omits a schema that is on the session's search_path: every signature here is schema-qualified.
  for (const f of fns) if (!f.signature.startsWith(`${f.schema}.`)) f.signature = `${f.schema}.${f.signature}`;
  const findings = [];
  const byOid = new Map(fns.map((f) => [f.oid, f]));
  const byQualified = new Map();
  const publicByName = new Map();
  const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const f of fns) {
    push(byQualified, `${f.schema}.${f.name}`.toLowerCase(), f);
    if (f.schema === 'public') push(publicByName, f.name.toLowerCase(), f);
  }
  const triggersOf = new Map();
  for (const t of triggers) push(triggersOf, `${t.rel_schema}.${t.rel}`.toLowerCase(), t.fn);

  for (const f of fns) {
    const t = lex(f.prosrc);
    f.tokens = t;
    f.blocks = f.language === 'plpgsql' ? parseBlocks(t) : { frames: [], protectors: () => [] };
    f.raises = raiseSites(t);
    f.calls = [];
    for (let i = 0; i < t.length; i += 1) {
      if (t[i].t !== 'word') continue;
      if (isOp(t[i + 1], '.') && t[i + 2]?.t === 'word' && isOp(t[i + 3], '(')) {
        for (const callee of byQualified.get(`${t[i].v}.${t[i + 2].v}`.toLowerCase()) ?? []) f.calls.push({ at: i, callee: callee.oid });
        i += 2;
        continue;
      }
      if (isOp(t[i + 1], '(') && !isOp(t[i - 1], '.')) {
        for (const callee of publicByName.get(t[i].v.toLowerCase()) ?? []) f.calls.push({ at: i, callee: callee.oid });
      }
      if (!t[i].quoted && DML.has(t[i].u) && !isWord(t[i - 1], 'DO') && !isWord(t[i - 1], 'FOR') && !isWord(t[i - 1], 'KEY')) {
        let j = i + 1;
        if (isWord(t[j], 'INTO') || isWord(t[j], 'FROM')) j += 1;
        if (isWord(t[j], 'ONLY')) j += 1;
        if (t[j]?.t === 'word' && isOp(t[j + 1], '.') && t[j + 2]?.t === 'word') {
          for (const trigger of triggersOf.get(`${t[j].v}.${t[j + 2].v}`.toLowerCase()) ?? []) f.calls.push({ at: i, callee: trigger, trigger: true });
        }
      }
    }
    for (const r of f.raises) if (r.dynamic) findings.push({ kind: 'DYNAMIC_ERRCODE', signature: f.signature });
    if (f.language === 'plpgsql' && t.some((tok, i) => isWord(tok, 'EXECUTE')
        && !['ON', 'GRANT', 'REVOKE', 'FUNCTION', 'PROCEDURE'].some((w) => isWord(t[i - 1], w)) && !isOp(t[i - 1], ','))) {
      findings.push({ kind: 'DYNAMIC_SQL', signature: f.signature });
    }
    if (/transaction_isolation/iu.test(f.proconfig ?? '') || t.some((tok, i) => isWord(tok, 'ISOLATION') && isWord(t[i - 1], 'TRANSACTION'))) {
      findings.push({ kind: 'ISOLATION', signature: f.signature });
    }
  }
  for (const r of await query(`SELECT setconfig::text AS config FROM pg_db_role_setting WHERE setconfig::text ILIKE '%isolation%'`)) {
    findings.push({ kind: 'ISOLATION', signature: `role/database setting ${r.config}` });
  }
  const [{ isolation }] = await query('SELECT current_setting(\'default_transaction_isolation\') AS isolation');
  if (isolation !== 'read committed') findings.push({ kind: 'ISOLATION', signature: `default_transaction_isolation = ${isolation}` });

  // The classifier, evaluated LIVE for every tracked message in the catalog.
  const verdicts = new Map();
  const [{ present }] = await query("SELECT to_regprocedure('public_authoring_private.classify_public_refusal_v1(text)') IS NOT NULL AS present");
  for (const f of fns) {
    for (const r of f.raises) {
      if (!TRACKED.includes(r.code) || verdicts.has(r.message)) continue;
      verdicts.set(r.message, present && r.message !== null
        ? (await query('SELECT public_authoring_private.classify_public_refusal_v1($1) AS v', [r.message]))[0].v : null);
    }
  }

  /** The first matching clause of the innermost protecting block decides; a missing PT409 next to a named 40001 is a trap. */
  const outcome = (f, at, code, message) => {
    for (const frame of f.blocks.protectors(at)) {
      if (code === NON_RETRYABLE_STALE && frame.clauses.some((c) => namedMatch(c.conditions, '40001'))
          && !frame.clauses.some((c) => namedMatch(c.conditions, NON_RETRYABLE_STALE))) {
        findings.push({ kind: 'CATCH_TRAP', signature: f.signature, message });
      }
      const clause = frame.clauses.find((c) => conditionMatches(c.conditions, code));
      if (!clause) continue;
      const by = `${f.signature} WHEN ${clause.conditions.join(' OR ')}`;
      const body = f.tokens.slice(clause.start, clause.end ?? f.tokens.length);
      const reraises = body.some((tok, i) => isWord(tok, 'RAISE') && isOp(body[i + 1], ';'));
      if (!reraises) return { absorbed: true, by };
      const classified = body.some((tok, i) => tok.t === 'word' && tok.v.toLowerCase() === 'classify_public_refusal_v1'
        && body.slice(i, i + 6).some((x) => isWord(x, 'SQLERRM')));
      if (classified && verdicts.get(message) != null) return { absorbed: true, by: `${by} -> classify_public_refusal_v1 = ${verdicts.get(message)}` };
      return { absorbed: false };
    }
    return { absorbed: false };
  };

  const escapes = new Map(fns.map((f) => [f.oid, new Map()]));
  const absorptions = new Map(fns.map((f) => [f.oid, new Map()]));
  for (const f of fns) {
    for (const r of f.raises) {
      if (!TRACKED.includes(r.code)) continue;
      const key = `${r.code}|${r.message}|${f.signature}`;
      const item = { code: r.code, message: r.message, origin: f.signature };
      const o = outcome(f, r.at, r.code, r.message);
      if (o.absorbed) absorptions.get(f.oid).set(`${key}|${o.by}`, { ...item, by: o.by });
      else escapes.get(f.oid).set(key, item);
    }
  }
  const seen = new Set();
  for (let grown = true; grown;) {
    grown = false;
    for (const f of fns) {
      for (const call of f.calls) {
        for (const [key, item] of escapes.get(call.callee) ?? []) {
          const visit = `${f.oid}|${call.at}|${key}`;
          if (seen.has(visit)) continue;
          seen.add(visit);
          const o = outcome(f, call.at, item.code, item.message);
          if (o.absorbed) { absorptions.get(f.oid).set(`${key}|${o.by}`, { ...item, by: o.by }); continue; }
          if (!escapes.get(f.oid).has(key)) { escapes.get(f.oid).set(key, item); grown = true; }
        }
      }
    }
  }
  const unique = new Map(findings.map((x) => [`${x.kind}|${x.signature}|${x.message ?? ''}`, x]));
  return { fns, byOid, escapes, absorptions, findings: [...unique.values()], classifierVerdicts: verdicts };
}

function reachable(analysis, oid) {
  const seen = new Set([oid]);
  const queue = [oid];
  while (queue.length) {
    for (const call of analysis.byOid.get(queue.shift())?.calls ?? []) {
      if (!seen.has(call.callee)) { seen.add(call.callee); queue.push(call.callee); }
    }
  }
  return seen;
}

/** The Data API entry points, with what can escape each of them and what is absorbed beneath them. */
export function entryPoints(analysis) {
  return analysis.fns
    .filter((f) => f.schema === 'public' && (f.anon || f.authenticated || f.service_role))
    .map((f) => {
      const below = [...reachable(analysis, f.oid)];
      const escapes = [...analysis.escapes.get(f.oid).values()];
      return {
        name: f.name,
        signature: f.signature,
        roles: ['anon', 'authenticated', 'service_role'].filter((r) => f[r]),
        retryable: escapes.filter((e) => RETRYABLE.includes(e.code)),
        stale: escapes.filter((e) => e.code === NON_RETRYABLE_STALE),
        absorbed: [...new Set(below.flatMap((o) => [...analysis.absorptions.get(o).values()])
          .filter((a) => RETRYABLE.includes(a.code)).map((a) => a.by))],
        reachesRetryableRaise: below.some((o) => analysis.byOid.get(o)?.raises.some((r) => RETRYABLE.includes(r.code))),
      };
    });
}

/** Every literal raise of a tracked SQLSTATE in the catalog. */
export function raiseCensus(analysis) {
  return analysis.fns.flatMap((f) => f.raises.filter((r) => TRACKED.includes(r.code))
    .map((r) => ({ signature: f.signature, code: r.code, message: r.message })));
}
