// S8B-05 CP2 (migration 0190): the exact edits 0190 makes to the functions it forward-replaces.
//
// Every function 0190 re-creates is its origin migration's statement, verbatim, with only the edits listed here (the
// 0183 / 0186 precedent). verify-migration-0190 re-derives each statement from its origin file and these edits, requires
// the result to equal the statement written in 0190, and the live `prosrc` to equal that statement's body. Earlier
// verifiers that pin one of these bodies byte for byte read `substitutedBody` once 0190 is applied.
import { readFileSync } from 'node:fs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

export const MIGRATION_0190 = '0190_s8b_05_live_call_spoken_turn_v1.sql';

// The comment lines every edit adds start with this tag, so a reader of the live body can find them.
const TAG = 'S8B-05 CP2 (0190';

// R2-G: a turn that carries a call_turn_index is the call authority's. The three generic terminal commands refuse it
// before they lock or change anything.
const GUARD = (indent) => `${indent}-- ${TAG}, R2-G): a live call's turn is never FAILED, CANCELLED or SUPERSEDED by a generic command.\n`
  + `${indent}IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id=p_source_turn_id) THEN `
  + "RAISE EXCEPTION 'CALL_TURN_OWNED_BY_CALL_AUTHORITY' USING ERRCODE='55000';END IF;\n";

export const SUBSTITUTIONS = [
  {
    key: 'fail-turn',
    origin: '0025_conversation_authority_hardening_v1.sql',
    header: 'FUNCTION public.fail_conversation_turn(',
    edits: [[' SELECT * INTO source_row FROM public.conversation_turns', `${GUARD(' ')} SELECT * INTO source_row FROM public.conversation_turns`]],
  },
  {
    key: 'cancel-turn',
    origin: '0019_runtime_event_outbox_publisher_v1.sql',
    header: 'FUNCTION public.cancel_conversation_turn(',
    edits: [[' SELECT * INTO source_row FROM public.conversation_turns', `${GUARD(' ')} SELECT * INTO source_row FROM public.conversation_turns`]],
  },
  {
    key: 'recover-turn',
    origin: '0039_foreground_generating_turn_recovery_v1.sql',
    header: 'FUNCTION public.recover_expired_generating_conversation_turn_v1(',
    edits: [['  SELECT * INTO source_row FROM public.conversation_turns', `${GUARD('  ')}  SELECT * INTO source_row FROM public.conversation_turns`]],
  },
  {
    key: 'personal-export',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION personal_data_private.build_personal_export_v1(',
    edits: [[
      "                                                 'confidenceBand', lower(vs.asr_confidence_band)))\n",
      "                                                 'confidenceBand', lower(vs.asr_confidence_band),\n"
      + `                                                 -- ${TAG}, CA-05-02): what of QANDEEL's spoken reply was heard.\n`
      + "                                                 'deliveryState', lower(vs.delivery_state)))\n",
    ]],
  },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// The 0190 statement for one substitution: the origin statement as CREATE OR REPLACE, each edit applied exactly once.
export function substitutedStatement(substitution) {
  const origin = readFileSync(new URL(substitution.origin, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
  let { statement } = extractStatement(origin, substitution.header);
  statement = statement.replace(/^CREATE (?:OR REPLACE )?FUNCTION /u, 'CREATE OR REPLACE FUNCTION ');
  for (const [from, to] of substitution.edits) {
    const n = occurrences(statement, from);
    if (n !== 1) throw new Error(`${substitution.key}: an edit must match exactly once, matched ${n}: ${from.slice(0, 80)}`);
    statement = statement.replace(from, () => to);
  }
  return statement;
}

// The body of one substitution's 0190 statement: what an earlier verifier that pins the function expects once 0190 is
// applied. Derived from the declared edits, never copied, so an earlier pin and 0190 cannot drift.
export function substitutedBody(key) {
  const substitution = SUBSTITUTIONS.find((s) => s.key === key);
  if (!substitution) throw new Error(`no 0190 substitution named ${key}`);
  return extractStatement(substitutedStatement(substitution), substitution.header).body;
}

/** The voice_private functions 0190's ACL block names (six; no role executes them; verify-migration-0190 proves their shape). */
export function voiceInternals0190() {
  const text = readFileSync(new URL(MIGRATION_0190, MIGRATIONS), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
}

// Whether migration 0190 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function liveCallTurnsApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('public.conversation_call_turns') IS NOT NULL AS applied");
  return applied;
}
