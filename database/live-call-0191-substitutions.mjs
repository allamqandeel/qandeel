// S8B-05 CP3 (migration 0191): the exact edits 0191 makes to the functions it forward-replaces.
//
// Every function 0191 re-creates is its latest defining statement, verbatim, with only the edits listed here (the 0183 /
// 0186 / 0190 precedent). verify-migration-0191 re-derives each statement from its origin file and these edits, requires
// the result to equal the statement written in 0191, and the live `prosrc` to equal that statement's body. Earlier
// verifiers that pin one of these bodies byte for byte read `substitutedBody` once 0191 is applied.
import { readFileSync } from 'node:fs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

export const MIGRATION_0191 = '0191_s8b_05_live_call_ordered_halves_v1.sql';

// The comment lines every edit adds start with this tag, so a reader of the live body can find them.
const TAG = 'S8B-05 CP3 (0191';

export const SUBSTITUTIONS = [
  {
    // CA-05-01 INPUT-01 (v1.1 §1.5, `0071:830-833`): a live call's USER turn is final-content at its commit and can only
    // ever become COMPLETED (0190's guard, R2′), so it is committable while it is still GENERATING. Only the half
    // coordinator reaches the writer with such a turn: the full coordinator requires both turns COMPLETED itself.
    key: 'writer-input-01',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(',
    edits: [[
      "  IF turn_row.status <> 'COMPLETED' THEN\n    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE'",
      `  -- ${TAG}, CA-05-01 INPUT-01 / R2′): a live call's USER turn is final-content at its commit and only ever becomes\n`
      + '  -- COMPLETED, so it is committable while GENERATING; only the half coordinator reaches here with one.\n'
      + "  IF turn_row.status <> 'COMPLETED' AND NOT (turn_row.status = 'GENERATING' AND turn_row.role = 'USER'\n"
      + "       AND EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id = turn_row.id AND ct.turn_role = 'USER')) THEN\n"
      + "    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE'",
    ]],
  },
  {
    // CA-05-01 O3a (A1 §1) and B3 (Part A, A3.3): a numbered call turn is established by the half coordinator only, and
    // an exchange whose analysis was abandoned for integrity is never established later (no hindsight).
    key: 'full-coordinator-o3a',
    origin: '0150_data_api_stale_state_non_retryable_sqlstate_v1.sql',
    header: 'FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(',
    edits: [[
      "      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';\n  END IF;\n",
      "      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';\n  END IF;\n"
      + `  -- ${TAG}, CA-05-01 O3a / B3): a numbered call turn is established by the half coordinator only, and an exchange whose\n`
      + '  -- analysis was abandoned for integrity is never established later.\n'
      + '  IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id IN (p_user_source_turn_id, p_assistant_source_turn_id)) THEN\n'
      + "    RAISE EXCEPTION 'CALL_TURN_HALF_ESTABLISHMENT_ONLY' USING ERRCODE='55000';\n"
      + '  END IF;\n'
      + "  IF EXISTS (SELECT 1 FROM voice_private.call_analysis_queue q WHERE q.turn_id = p_user_source_turn_id AND q.queue_state = 'ABANDONED_INTEGRITY') THEN\n"
      + "    RAISE EXCEPTION 'SEMANTIC_ITEM_ABANDONED' USING ERRCODE='55000';\n"
      + '  END IF;\n',
    ]],
  },
  {
    // R7′ (A2): the reply's analysis half is queued by the close that creates the reply turn, whichever close wins.
    key: 'close-core-assistant-half',
    origin: '0190_s8b_05_live_call_spoken_turn_v1.sql',
    header: 'FUNCTION voice_private.close_call_exchange_core_v1(',
    edits: [[
      "  RETURN QUERY SELECT 'CLOSED'::text, p_assistant_turn_id, v_delivery, v_mark, v_start, v_end;\n",
      `  -- ${TAG}, R7′): the reply's analysis half is queued by the close that creates it.\n`
      + '  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id)\n'
      + "  VALUES (p_call_id, p_call_turn_index, 'ASSISTANT', v_ex.user_id, v_ex.session_id, p_assistant_turn_id);\n"
      + "  RETURN QUERY SELECT 'CLOSED'::text, p_assistant_turn_id, v_delivery, v_mark, v_start, v_end;\n",
    ]],
  },
  {
    // O3b (A1 §1, as amended by DEC-R1-1) and B1 (Part A, A3.3): the call's activation adopts the session's completed
    // exchanges that were never established (activate-call-o3b, below); the first turn adopts only what completed after
    // the activation, after the activation's items, so the one order is kept.
    key: 'commit-turn-o3b',
    origin: '0190_s8b_05_live_call_spoken_turn_v1.sql',
    header: 'FUNCTION public.server_commit_live_call_turn_v1(',
    edits: [[
      "  VALUES (p_call_id, v_index, 'USER', p_user_id, v_call.session_id, p_turn_id);\n",
      "  VALUES (p_call_id, v_index, 'USER', p_user_id, v_call.session_id, p_turn_id);\n"
      + `  -- ${TAG}, O3b / B1, as amended by DEC-R1-1): the call's first turn adopts the session's unestablished earlier\n`
      + "  -- exchanges that completed after its activation, after the activation's, at the head of its analysis order.\n"
      + '  IF v_index = 1 THEN\n'
      + '    PERFORM voice_private.adopt_pre_call_exchanges_v1(p_call_id, p_user_id, v_call.session_id, 0);\n'
      + '  END IF;\n',
    ]],
  },
  {
    // O3b as amended by DEC-R1-1 (the Product Owner, 2026-11-03): the call's activation adopts the session's unestablished
    // pre-call exchanges at the head of its analysis order, in the SAME transaction as the activation, so their analysis
    // runs before the person's first turn instead of after it. Once per call: only CONNECTING -> ACTIVE reaches here.
    key: 'activate-call-o3b',
    origin: '0189_s8b_05_live_call_authority_v1.sql',
    header: 'FUNCTION public.server_activate_call_v1(',
    edits: [[
      "  RETURN QUERY SELECT 'ACTIVE'::text, v_now, v_open.recording_id, v_open.retention_expires_at;\n",
      `  -- ${TAG}, O3b as amended by DEC-R1-1): the activation adopts the session's unestablished pre-call exchanges, keeping\n`
      + '  -- 1000 slots below the first turn for an exchange that completes before it.\n'
      + '  PERFORM voice_private.adopt_pre_call_exchanges_v1(p_call_id, p_user_id, v_call.session_id, 1000);\n'
      + "  RETURN QUERY SELECT 'ACTIVE'::text, v_now, v_open.recording_id, v_open.retention_expires_at;\n",
    ]],
  },
  {
    // R5′ / P2 (A2, A3.2): the call's open exchange closes with the call's end, in the same transaction, by the ONE close,
    // when its Safety is stored. One whose Safety was never stored stays open for S3 (A3.1): the gate is TypeScript, so
    // the sweep recomputes it with the same gate over the same reader outside the database, stores it, then closes.
    key: 'end-call-closes-exchange',
    origin: '0189_s8b_05_live_call_authority_v1.sql',
    header: 'FUNCTION voice_private.end_call_v1(',
    edits: [
      ['  v_recording uuid;\nBEGIN\n', `  v_recording uuid;\n  -- ${TAG}, R5′): the call's open exchange, closed with its END.\n  v_open voice_private.call_exchanges;\nBEGIN\n`],
      [
        "  SELECT r.id INTO v_recording FROM voice_private.recordings r\n   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING' FOR UPDATE;\n",
        `  -- ${TAG}, R5′ / P2): the open exchange closes with the call's end by the ONE close (the first commit wins) when its\n`
        + '  -- Safety is stored; one whose Safety was never stored stays open for the S3 sweep (A3.1).\n'
        + "  SELECT * INTO v_open FROM voice_private.call_exchanges e WHERE e.call_id = p_call_id AND e.exchange_state = 'OPEN' FOR UPDATE;\n"
        + '  IF FOUND AND v_open.safety_disposition IS NOT NULL THEN\n'
        + "    PERFORM voice_private.close_call_exchange_core_v1(p_call_id, v_open.call_turn_index, 'CALL_ENDING', gen_random_uuid(), gen_random_uuid());\n"
        + '  END IF;\n'
        + "  SELECT r.id INTO v_recording FROM voice_private.recordings r\n   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING' FOR UPDATE;\n",
      ],
    ],
  },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// The 0191 statement for one substitution: the origin statement as CREATE OR REPLACE, each edit applied exactly once.
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

// The body of one substitution's 0191 statement: what an earlier verifier that pins the function expects once 0191 is
// applied. Derived from the declared edits, never copied, so an earlier pin and 0191 cannot drift.
export function substitutedBody(key) {
  const substitution = SUBSTITUTIONS.find((s) => s.key === key);
  if (!substitution) throw new Error(`no 0191 substitution named ${key}`);
  return extractStatement(substitutedStatement(substitution), substitution.header).body;
}

// Whether migration 0191 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function liveCallHalvesApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regprocedure('public.server_claim_call_analysis_item_v1(uuid,uuid)') IS NOT NULL AS applied");
  return applied;
}

/** The voice_private functions 0191's ACL block names (no role executes them; verify-migration-0191 proves their shape). */
export function voiceInternals0191() {
  const text = readFileSync(new URL(MIGRATION_0191, MIGRATIONS), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
}
