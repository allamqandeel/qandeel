// S8B-05 CP4 (migration 0192): the exact edits 0192 makes to the functions it forward-replaces.
//
// Every function 0192 re-creates is its latest defining statement, verbatim, with only the edits listed here (the 0183 /
// 0186 / 0190 / 0191 precedent). verify-migration-0192 re-derives each statement from its origin file and these edits,
// requires the result to equal the statement written in 0192, and the live `prosrc` to equal that statement's body.
// Earlier verifiers that pin one of these bodies byte for byte read `substitutedBody` once 0192 is applied.
import { readFileSync } from 'node:fs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

export const MIGRATION_0192 = '0192_s8b_05_live_call_barge_in_text_turn_v1.sql';

// The comment lines every edit adds start with this tag, so a reader of the live body can find them.
const TAG = 'S8B-05 CP4 (0192';

export const SUBSTITUTIONS = [
  {
    // D-05-07 / A1 §1 (N1, R5′): a typed turn in the call (TEXT_TURN) is answered in text, never spoken. The ONE close
    // takes the exchange's channel from its numbered USER turn: a TEXT exchange has no playout, no anchor and no voice
    // source; its reply is the text stored by its own close (TEXT_REPLIED), or nothing when N1 or the call's end closed it
    // first (INTERRUPTED) or its generation failed (FAILED). A spoken exchange is closed exactly as before.
    key: 'close-core-text-exchange',
    origin: '0191_s8b_05_live_call_ordered_halves_v1.sql',
    header: 'FUNCTION voice_private.close_call_exchange_core_v1(',
    edits: [
      [
        "     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING') THEN\n",
        "     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING', 'TEXT_REPLIED') THEN\n"
        + `    -- ${TAG}, D-05-07): TEXT_REPLIED, the close of a typed exchange by its text reply.\n`,
      ],
      ['  v_end bigint;\nBEGIN\n', `  v_end bigint;\n  -- ${TAG}, D-05-07): the exchange's channel, from its numbered USER turn.\n  v_channel text;\nBEGIN\n`],
      [
        "  IF v_recording IS NULL THEN RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000'; END IF;\n",
        "  IF v_recording IS NULL THEN RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000'; END IF;\n"
        + `  -- ${TAG}, D-05-07): a typed exchange is closed by its text reply, never by a playout; a spoken one never by text.\n`
        + '  SELECT ct.turn_channel INTO v_channel FROM public.conversation_call_turns ct WHERE ct.turn_id = v_ex.user_turn_id;\n'
        + "  IF v_channel IS NULL OR (v_channel = 'TEXT' AND p_reason = 'PLAYED_OUT') OR (v_channel = 'SPEECH' AND p_reason = 'TEXT_REPLIED') THEN\n"
        + "    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';\n"
        + '  END IF;\n',
      ],
      [
        "  ELSE\n    v_delivery := 'INTERRUPTED';\n  END IF;\n",
        "  ELSE\n    v_delivery := 'INTERRUPTED';\n  END IF;\n"
        + `  -- ${TAG}, D-05-07): a typed exchange's reply is its stored text (no mark: nothing of it was played); closed first by\n`
        + "  -- N1 or the call's end, it is INTERRUPTED with no text, and a failed generation is FAILED with none.\n"
        + "  IF v_channel = 'TEXT' THEN\n"
        + "    v_text := CASE WHEN p_reason = 'TEXT_REPLIED' THEN coalesce(v_ex.text_reply, '') ELSE '' END;\n"
        + "    v_terms := CASE WHEN p_reason = 'TEXT_REPLIED' THEN coalesce(v_ex.text_reply_terms, '{}') ELSE '{}' END;\n"
        + "    v_delivery := CASE p_reason WHEN 'TEXT_REPLIED' THEN v_ex.text_reply_state WHEN 'GENERATION_FAILED' THEN 'FAILED' ELSE 'INTERRUPTED' END;\n"
        + '  END IF;\n',
      ],
      [
        '  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,\n'
        + '                                                      transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,\n'
        + '                                                      anchor_end_ms, spoken, delivery_state)\n'
        + "  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, 'ASSISTANT', 'LIVE_CALL_SPEECH', NULL, NULL, v_recording,\n"
        + '          v_start, v_end, true, v_delivery);\n',
        `  -- ${TAG}, D-05-07): a text reply was never spoken, so it has no voice source; its delivery state is the exchange's.\n`
        + "  IF v_channel = 'SPEECH' THEN\n"
        + '  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,\n'
        + '                                                      transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,\n'
        + '                                                      anchor_end_ms, spoken, delivery_state)\n'
        + "  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, 'ASSISTANT', 'LIVE_CALL_SPEECH', NULL, NULL, v_recording,\n"
        + '          v_start, v_end, true, v_delivery);\n'
        + '  END IF;\n',
      ],
      ["  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, p_call_id, p_call_turn_index, 'ASSISTANT', 'SPEECH',\n",
        `  -- ${TAG}, D-05-07): the reply takes its exchange's channel.\n`
        + '  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, p_call_id, p_call_turn_index, \'ASSISTANT\', v_channel,\n'],
    ],
  },
  {
    // CA-05-02 (§2.3) widened to the typed exchange: no consumer reads a call reply without its delivery state, and a text
    // reply in the call has no voice source, so its state is read from the exchange that closed it.
    key: 'delivery-read-text-reply',
    origin: '0190_s8b_05_live_call_spoken_turn_v1.sql',
    header: 'FUNCTION public.server_read_call_reply_delivery_v1(',
    edits: [[
      "       AND vs.source_role = 'ASSISTANT' AND vs.source_modality = 'LIVE_CALL_SPEECH'\n     ORDER BY vs.turn_id;\n",
      "       AND vs.source_role = 'ASSISTANT' AND vs.source_modality = 'LIVE_CALL_SPEECH'\n"
      + `    -- ${TAG}, D-05-07): a typed exchange's text reply, whose delivery state is the exchange's own.\n`
      + '    UNION ALL\n'
      + '    SELECT e.assistant_turn_id, e.delivery_state\n'
      + '      FROM voice_private.call_exchanges e\n'
      + "      JOIN public.conversation_call_turns ct ON ct.turn_id = e.assistant_turn_id AND ct.turn_channel = 'TEXT'\n"
      + "     WHERE e.user_id = p_user_id AND e.session_id = p_session_id AND e.assistant_turn_id = ANY (p_turn_ids) AND e.exchange_state = 'CLOSED'\n"
      + '     ORDER BY 1;\n',
    ]],
  },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// The 0192 statement for one substitution: the origin statement as CREATE OR REPLACE, each edit applied exactly once.
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

// The body of one substitution's 0192 statement: what an earlier verifier that pins the function expects once 0192 is
// applied. Derived from the declared edits, never copied, so an earlier pin and 0192 cannot drift.
export function substitutedBody(key) {
  const substitution = SUBSTITUTIONS.find((s) => s.key === key);
  if (!substitution) throw new Error(`no 0192 substitution named ${key}`);
  return extractStatement(substitutedStatement(substitution), substitution.header).body;
}

// The voice_private functions 0192 adds (named in its ACL block and created there, not forward-replaced): what an earlier
// verifier that censuses voice_private counts once 0192 is applied.
export function voiceInternals0192() {
  const text = readFileSync(new URL(MIGRATION_0192, MIGRATIONS), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.([a-z_0-9]+)\([^']*\))'/gu)]
    .filter((m) => text.includes(`CREATE FUNCTION voice_private.${m[2]}(`)).map((m) => m[1]);
}

// Whether migration 0192 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function liveCallTextTurnApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regprocedure('public.server_close_live_call_text_exchange_v1(uuid,uuid,integer,text,text,text[],uuid,uuid)') IS NOT NULL AS applied");
  return applied;
}
