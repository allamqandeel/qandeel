// S8B-03 CP1 (migration 0186): the exact edits 0186 makes to the functions it forward-replaces or derives.
//
// Every function 0186 re-creates is its latest origin statement, verbatim, with only the edits listed here (the 0150 / 0183
// precedent). `CREATE FUNCTION` becomes `CREATE OR REPLACE FUNCTION`, so the signature, owner and ACL are kept. Three new
// functions are derived the same way from the statement they extend, under a new name (`target`): Open Understanding v4
// from v3, the known-Memories read v2 from v1, and nothing else. verify-migration-0186 re-derives each statement from its
// origin file and these edits, requires the result to equal the statement written in 0186, and the live `prosrc` to equal
// that statement's body. Nothing here is generated at deploy time; this module is the reviewable statement of the diff.
import { readFileSync } from 'node:fs';
import { extractStatement } from './voice-foundation-0183-substitutions.mjs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

// The comment lines every edit adds start with this tag, so a reader of the live body can find them.
const TAG = 'S8B-03 (0186';

export const MIGRATION_0186 = '0186_s8b_03_personal_voice_notes_v1.sql';

export const SUBSTITUTIONS = [
  {
    // §5.2 (BLOCKER-1): a replayed begin of an accepted note answers ALREADY_ACCEPTED; the signature is v1's.
    key: 'note-upload-replay',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION public.server_begin_voice_note_upload_v1(',
    edits: [
      ["    ELSE\n      RETURN QUERY SELECT CASE WHEN v_existing.user_id = p_user_id THEN 'UNAVAILABLE' ELSE 'COMMAND_CONFLICT' END,\n"
       + '                          NULL::uuid, NULL::text, NULL::timestamptz;\n',
       `    -- ${TAG}, §5.2): the same command replayed after its note was accepted names that note again, so the client\n`
       + '    -- receives the answer it lost (the API reads it from the accept command\'s read-only STORED branch). Nothing is\n'
       + '    -- written; no key and no deadline are handed back. Another session or another size is another command.\n'
       + '    ELSIF v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id\n'
       + "       AND v_existing.recording_kind = 'VOICE_NOTE' AND v_existing.recording_state = 'STORED'\n"
       + '       AND clock_timestamp() < v_existing.retention_expires_at\n'
       + '       AND EXISTS (SELECT 1 FROM voice_private.recording_objects o\n'
       + '                    WHERE o.recording_id = v_existing.id AND o.byte_size = p_byte_size) THEN\n'
       + "      RETURN QUERY SELECT 'ALREADY_ACCEPTED'::text, v_existing.id, NULL::text, NULL::timestamptz;\n"
       + '    ELSE\n'
       + "      RETURN QUERY SELECT CASE WHEN v_existing.user_id <> p_user_id THEN 'COMMAND_CONFLICT'\n"
       + "                               WHEN v_existing.session_id <> p_session_id THEN 'COMMAND_CONFLICT'\n"
       + "                               WHEN v_existing.recording_state = 'STORED'\n"
       + "                                    AND clock_timestamp() < v_existing.retention_expires_at THEN 'COMMAND_CONFLICT'\n"
       + "                               ELSE 'UNAVAILABLE' END,\n"
       + '                          NULL::uuid, NULL::text, NULL::timestamptz;\n'],
    ],
  },
  {
    // E1: MACHINE_ASR enters the L2 eligibility gate (step B); SELF, DERIVED_INSIGHT, the duplicate rank and 64 stay.
    key: 'evidence-eligibility',
    origin: '0152_memory_subject_identity_atomicity_v1.sql',
    header: 'FUNCTION public.canonical_eligible_memory_ids_v1(',
    edits: [
      ["    WHERE candidate.source IN ('USER_STATED','USER_CONFIRMED') AND candidate.type<>'DERIVED_INSIGHT'\n",
       `    -- ${TAG}, E1 / D1): a machine transcript of the user's own voice is Fresh Evidence; L1 widens with it.\n`
       + "    WHERE candidate.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND candidate.type<>'DERIVED_INSIGHT'\n"],
    ],
  },
  {
    // E2: L1 widens in parallel (NOT_SELF, UNATTRIBUTED, CURRENT), so L2 stays a subset of CURRENT.
    key: 'evidence-standing',
    origin: '0152_memory_subject_identity_atomicity_v1.sql',
    header: 'FUNCTION public.personal_evidence_standing_v1(',
    edits: [
      ["      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'OTHER' THEN 'NOT_SELF'\n",
       `      -- ${TAG}, E2): MACHINE_ASR stands exactly where the typed sources stand (L2 is a subset of CURRENT).\n`
       + "      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'OTHER' THEN 'NOT_SELF'\n"],
      ["      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject IS NULL THEN 'UNATTRIBUTED'\n",
       "      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject IS NULL THEN 'UNATTRIBUTED'\n"],
      ["      WHEN m.status = 'ACTIVE' AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'SELF' THEN 'CURRENT'\n",
       "      WHEN m.status = 'ACTIVE' AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'SELF' THEN 'CURRENT'\n"],
    ],
  },
  {
    // E13: the deterministic writer's score is the band's constant exactly (it accepted any value below 0.95).
    key: 'background-memory-writer',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION public.background_record_memory_v1(',
    edits: [
      ['    IF p_confidence IS NULL OR NOT (p_confidence < 0.95) THEN\n',
       `    -- ${TAG}, E13): the score is the band's controlled constant, exactly; a direct call cannot choose it.\n`
       + '    IF p_confidence IS NULL OR p_confidence IS DISTINCT FROM voice_private.machine_asr_memory_confidence_v1(v_band) THEN\n'],
    ],
  },
  {
    // E8 / E9 / E13: spoken Memory commands by band, the typed confirmation of a kept voice fact, and the band's score.
    key: 'memory-control-finalize',
    origin: '0152_memory_subject_identity_atomicity_v1.sql',
    header: 'FUNCTION public.server_finalize_memory_control_turn_v2(',
    edits: [
      ['  finalized_assistant jsonb;\nBEGIN\n',
       '  finalized_assistant jsonb;\n'
       + `  -- ${TAG}, E8 / E9 / E13): the voice source of this turn and of the turn whose words are kept.\n`
       + '  v_turn_voice boolean := false;\n'
       + '  v_turn_band text;\n'
       + '  v_origin_voice boolean := false;\n'
       + '  v_origin_band text;\n'
       + "  v_source text := 'USER_STATED';\n"
       + '  v_confirm_memory uuid;\n'
       + '  v_confirm_turn uuid;\n'
       + 'BEGIN\n'],
      ["    'SUBJECT_CLARIFICATION_REQUIRED')\n  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_OUTCOME' USING ERRCODE='22023'; END IF;\n",
       "    'SUBJECT_CLARIFICATION_REQUIRED','NOT_HEARD_CLEARLY')\n  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_OUTCOME' USING ERRCODE='22023'; END IF;\n"],
      ['  IF NOT FOUND THEN RETURN; END IF;\n\n  IF EXISTS (SELECT 1 FROM unnest(candidates) c\n',
       '  IF NOT FOUND THEN RETURN; END IF;\n'
       + `  -- ${TAG}, E8, §4.9.4): the turn's voice source and band are read here, never taken from the caller. A LOW turn\n`
       + '  -- changes no Memory; a voice answer counts only from HIGH; a spoken FORGET / DISABLE is never executed in the turn\n'
       + '  -- that says it - only the next turn\'s confirmation executes it. NOT_HEARD_CLEARLY exists only for a voice turn.\n'
       + '  SELECT vs.asr_confidence_band INTO v_turn_band FROM public.conversation_turn_voice_sources vs\n'
       + '   WHERE vs.turn_id = source_row.id AND vs.user_id = p_user_id;\n'
       + '  v_turn_voice := FOUND;\n'
       + '  IF v_turn_voice AND (\n'
       + "       (v_turn_band NOT IN ('HIGH','MEDIUM') AND p_outcome IN ('REMEMBERED','CORRECTED','FORGOTTEN','DISABLED'))\n"
       + "    OR (v_turn_band <> 'HIGH' AND p_answers_command_id IS NOT NULL)\n"
       + "    OR (p_outcome IN ('FORGOTTEN','DISABLED') AND p_answers_command_id IS NULL))\n"
       + "  THEN RAISE EXCEPTION 'MACHINE_ASR_MEMORY_COMMAND_REFUSED' USING ERRCODE='42501'; END IF;\n"
       + "  IF p_outcome = 'NOT_HEARD_CLEARLY' AND (NOT v_turn_voice OR p_kind NOT IN ('REMEMBER','CORRECT','FORGET','DISABLE')\n"
       + '       OR p_target_memory_id IS NOT NULL OR p_new_memory_id IS NOT NULL OR cardinality(candidates) <> 0\n'
       + '       OR p_answers_command_id IS NOT NULL)\n'
       + "  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;\n"
       + '\n  IF EXISTS (SELECT 1 FROM unnest(candidates) c\n'],
      ["    THEN RAISE EXCEPTION 'INVALID_MEMORY_CLARIFICATION_ANSWER' USING ERRCODE='42501'; END IF;\n  END IF;\n",
       "    THEN RAISE EXCEPTION 'INVALID_MEMORY_CLARIFICATION_ANSWER' USING ERRCODE='42501'; END IF;\n  END IF;\n"
       + `  -- ${TAG}, E8 / E13): what is kept comes from the words of the turn that asked (an answer's own words only choose),\n`
       + "  -- so the Memory's source and score follow that turn's voice source and band: MACHINE_ASR at the band's constant\n"
       + '  -- exactly, never USER_STATED, never from LOW.\n'
       + '  SELECT vs.asr_confidence_band INTO v_origin_band FROM public.conversation_turn_voice_sources vs\n'
       + '   WHERE vs.turn_id = coalesce(pending.source_turn_id, source_row.id) AND vs.user_id = p_user_id;\n'
       + '  v_origin_voice := FOUND;\n'
       + "  IF v_origin_voice AND p_outcome IN ('REMEMBERED','CORRECTED') THEN\n"
       + "    IF v_origin_band NOT IN ('HIGH','MEDIUM') THEN\n"
       + "      RAISE EXCEPTION 'MACHINE_ASR_MEMORY_COMMAND_REFUSED' USING ERRCODE='42501'; END IF;\n"
       + '    IF p_confidence IS DISTINCT FROM voice_private.machine_asr_memory_confidence_v1(v_origin_band) THEN\n'
       + "      RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023'; END IF;\n"
       + "    v_source := 'MACHINE_ASR';\n"
       + '  END IF;\n'],
      ["    IF p_new_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;\n"
       + "    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       "    IF p_new_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;\n"
       + "    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
      ["      applied := 'ALREADY_REMEMBERED';\n      reply := p_reply_if_existing;\n",
       "      applied := 'ALREADY_REMEMBERED';\n      reply := p_reply_if_existing;\n"
       + `      -- ${TAG}, E9): the user's own typed words remember a fact kept from a voice message: the typed confirmation\n`
       + '      -- is recorded beside it. Its source, score and words never change, and no second Memory is created.\n'
       + "      IF NOT v_origin_voice AND retained.source = 'MACHINE_ASR' THEN\n"
       + '        v_confirm_memory := retained.id;\n'
       + '        v_confirm_turn := coalesce(pending.source_turn_id, source_row.id);\n'
       + '      END IF;\n'],
      ["          p_user_id, reconfirmed.id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       "          p_user_id, reconfirmed.id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
      ["          p_user_id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       "          p_user_id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
      ["    IF p_new_memory_id IS NULL OR p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;\n"
       + "    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       "    IF p_new_memory_id IS NULL OR p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;\n"
       + "    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
      ["          p_user_id, target.id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"
       + "        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;\n"
       + '        result_id := changed.id;\n',
       "          p_user_id, target.id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"
       + "        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;\n"
       + '        result_id := changed.id;\n'
       + `        -- ${TAG}, E9, C-57): a typed yes to the one-option question that showed the heard correction (old and new)\n`
       + '        -- confirms the new value as heard; the successor stays MACHINE_ASR.\n'
       + '        IF v_origin_voice AND NOT v_turn_voice AND p_answers_command_id IS NOT NULL\n'
       + "           AND pending.outcome = 'CLARIFICATION_REQUIRED' AND cardinality(pending.candidate_memory_ids) = 1 THEN\n"
       + '          v_confirm_memory := changed.id;\n'
       + '          v_confirm_turn := source_row.id;\n'
       + '        END IF;\n'],
      ['    candidates, p_answers_command_id);\n',
       '    candidates, p_answers_command_id);\n'
       + '  IF v_confirm_memory IS NOT NULL THEN\n'
       + "    PERFORM public.record_memory_typed_confirmation_v1(p_user_id, v_confirm_memory, v_confirm_turn, 'EXPLICIT_MEMORY_COMMAND', new_command_id, NULL);\n"
       + '  END IF;\n'],
    ],
  },
  {
    // E6 / E9 / E11 / E13: Open Understanding v4 = v3 + the turn's source and band + the operation table + confirmations.
    key: 'open-understanding-v4',
    origin: '0173_s8a_03_open_understanding_v1.sql',
    header: 'FUNCTION public.complete_post_response_personal_capture_v3(',
    target: 'FUNCTION public.complete_post_response_personal_capture_v4(',
    edits: [
      ['FUNCTION public.complete_post_response_personal_capture_v3(\n', 'FUNCTION public.complete_post_response_personal_capture_v4(\n'],
      ['  p_correct_importances double precision[], p_correct_slots text[], p_correct_temporals text[]\n) RETURNS text\n',
       '  p_correct_importances double precision[], p_correct_slots text[], p_correct_temporals text[],\n'
       + '  p_confirmed_memory_ids uuid[]\n) RETURNS text\n'],
      ['  target uuid;\n  i integer;\nBEGIN\n',
       '  target uuid;\n  i integer;\n'
       + `  -- ${TAG}, E6 / E9 / E11 / E13): the turn's voice source, read below; a typed turn keeps exactly v3's values.\n`
       + '  confirmed_count integer := coalesce(cardinality(p_confirmed_memory_ids), 0);\n'
       + "  confirmed_ids uuid[] := '{}';\n"
       + '  v_band text;\n'
       + "  v_source text := 'USER_STATED';\n"
       + '  v_confidence double precision := 0.80;\n'
       + "  v_uncertain text[] := '{}';\n"
       + '  v_tokens_known boolean := true;\n'
       + 'BEGIN\n'],
      ['     OR reaffirmed_count + ended_count > 20\n',
       '     OR reaffirmed_count + ended_count + confirmed_count > 20 OR confirmed_count > 3\n'
       + '     OR array_position(p_confirmed_memory_ids, NULL) IS NOT NULL\n'
       + "     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_confirmed_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)\n"
       + "     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_confirmed_memory_ids, '{}')) u(id)\n"
       + "                 WHERE u.id = ANY (coalesce(p_ended_memory_ids, '{}') || coalesce(p_forget_memory_ids, '{}')\n"
       + "                                   || coalesce(p_correct_memory_ids, '{}') || coalesce(p_memory_ids, '{}')\n"
       + "                                   || coalesce(p_correct_new_ids, '{}')))\n"],
      ['  SELECT * INTO source_row FROM public.conversation_turns t\n   WHERE t.id = execution_row.source_turn_id AND t.user_id = execution_row.user_id;\n',
       '  SELECT * INTO source_row FROM public.conversation_turns t\n   WHERE t.id = execution_row.source_turn_id AND t.user_id = execution_row.user_id;\n'
       + `  -- ${TAG}, §4.9.3): the turn's voice source decides the source, the score and the operations, read here and never\n`
       + '  -- taken from the caller. HIGH adds and changes with full lineage and never forgets; MEDIUM adds about the user and\n'
       + '  -- restates, and never writes about someone else or changes anything; LOW only indexes earlier Memories. A person\n'
       + '  -- label containing a word heard below T_HIGH is refused (E11); when those words are no longer known (the\n'
       + '  -- recording was deleted or expired), no label is accepted. A typed confirmation comes only from typed words.\n'
       + '  SELECT vs.asr_confidence_band INTO v_band FROM public.conversation_turn_voice_sources vs\n'
       + '   WHERE vs.turn_id = source_row.id AND vs.user_id = execution_row.user_id;\n'
       + '  IF FOUND THEN\n'
       + "    v_source := 'MACHINE_ASR';\n"
       + '    v_confidence := voice_private.machine_asr_memory_confidence_v1(v_band);\n'
       + '    SELECT n.uncertain_tokens INTO v_uncertain FROM voice_private.note_transcriptions n\n'
       + '      JOIN voice_private.recordings r ON r.id = n.recording_id\n'
       + "     WHERE n.committed_turn_id = source_row.id AND n.user_id = execution_row.user_id AND r.recording_state = 'STORED';\n"
       + '    v_tokens_known := FOUND;\n'
       + "    v_uncertain := coalesce(v_uncertain, '{}');\n"
       + '    IF forget_count > 0 OR confirmed_count > 0\n'
       + '       OR (v_confidence IS NULL AND (item_count > 0 OR correct_count > 0 OR reaffirmed_count > 0 OR ended_count > 0))\n'
       + "       OR (v_band = 'MEDIUM' AND (correct_count > 0 OR ended_count > 0 OR 'OTHER' = ANY (coalesce(p_subjects, '{}'))))\n"
       + "       OR (NOT v_tokens_known AND 'OTHER' = ANY (coalesce(p_subjects, '{}')))\n"
       + "       OR EXISTS (SELECT 1 FROM unnest(coalesce(p_person_names, '{}') || coalesce(p_person_relations, '{}')) l(label),\n"
       + "                         regexp_split_to_table(public.memory_equivalence_key_v1(l.label), ' ') w(word)\n"
       + "                   WHERE l.label IS NOT NULL AND w.word <> ''\n"
       + '                     AND w.word IN (SELECT public.memory_equivalence_key_v1(u.token) FROM unnest(v_uncertain) u(token)))\n'
       + '    THEN\n'
       + "      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';\n"
       + '    END IF;\n'
       + '  END IF;\n'],
      ["\n        p_correct_types[i], p_correct_contents[i], 'USER_STATED', 0.80, p_correct_importances[i], 'ACTIVE', NULL);\n",
       '\n        p_correct_types[i], p_correct_contents[i], v_source, v_confidence, p_correct_importances[i], \'ACTIVE\', NULL);\n'],
      ["\n      'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);\n",
       "\n      v_source, v_confidence, p_importances[i], 'ACTIVE', p_expires_at[i]);\n"],
      ['    FOREACH target IN ARRAY restate_ids LOOP\n',
       `    -- ${TAG}, E9, M-03): an item the typed message explicitly confirms gains its typed confirmation and counts as a\n`
       + '    -- restatement. Its source, score and words never change; only an earlier MACHINE_ASR Memory qualifies.\n'
       + "    FOREACH target IN ARRAY coalesce(p_confirmed_memory_ids, '{}') LOOP\n"
       + '      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.memories m\n'
       + '                                 WHERE m.id = target AND m.user_id = execution_row.user_id AND m.created_at < source_row.created_at);\n'
       + '      CONTINUE WHEN NOT public.record_memory_typed_confirmation_v1(execution_row.user_id, target, source_row.id,\n'
       + "                                                                  'MODEL_ASSISTED_CONFIRMATION', NULL, execution_row.id);\n"
       + '      confirmed_ids := confirmed_ids || target;\n'
       + '      IF NOT target = ANY (restate_ids) THEN restate_ids := restate_ids || target; END IF;\n'
       + '    END LOOP;\n'
       + '    FOREACH target IN ARRAY restate_ids LOOP\n'],
      ['  END IF;\n\n  DELETE FROM public.memory_retrieval_terms t USING public.memories m\n',
       '  END IF;\n'
       + '  updated_ids := updated_ids || ARRAY(SELECT c FROM unnest(confirmed_ids) c WHERE NOT c = ANY (updated_ids));\n'
       + '\n  DELETE FROM public.memory_retrieval_terms t USING public.memories m\n'],
    ],
  },
  {
    // E5: the known Memories with their source and their typed confirmation (a new return type needs a new name).
    key: 'known-memories-v2',
    origin: '0173_s8a_03_open_understanding_v1.sql',
    header: 'FUNCTION public.background_known_memories_v1(',
    target: 'FUNCTION public.background_known_memories_v2(',
    edits: [
      ['FUNCTION public.background_known_memories_v1(p_source_turn_id uuid, p_limit integer)\n',
       'FUNCTION public.background_known_memories_v2(p_source_turn_id uuid, p_limit integer)\n'],
      ['  temporal text, ended boolean, terms text[])\n',
       '  temporal text, ended boolean, terms text[], source text, confirmed_by_typing boolean)\n'],
      ['           ARRAY(SELECT t.term FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id AND t.user_id = m.user_id ORDER BY t.term)\n',
       '           ARRAY(SELECT t.term FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id AND t.user_id = m.user_id ORDER BY t.term),\n'
       + `           -- ${TAG}, E5): the source reaches the model, and so does a typed confirmation of a MACHINE_ASR item.\n`
       + '           m.source,\n'
       + '           EXISTS (SELECT 1 FROM public.memory_typed_confirmations c WHERE c.memory_id = m.id AND c.user_id = m.user_id)\n'],
    ],
  },
  {
    // §4.6 rule 10: the voice module erases the transcription state with the recordings (before them: they name them).
    key: 'voice-erasure',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION account_erasure_private.erase_voice_v1(',
    edits: [
      ['  DELETE FROM voice_private.recording_gaps g WHERE g.recording_id = ANY (v_recordings);\n',
       `  -- ${TAG}, §4.6 rule 10): the transcription state and its provider attempts leave with their recordings.\n`
       + '  DELETE FROM voice_private.note_transcription_attempts a WHERE a.recording_id = ANY (v_recordings);\n'
       + '  DELETE FROM voice_private.note_transcriptions n WHERE n.recording_id = ANY (v_recordings);\n'
       + '  DELETE FROM voice_private.recording_gaps g WHERE g.recording_id = ANY (v_recordings);\n'],
    ],
  },
  {
    key: 'voice-erasure-residue',
    origin: '0183_s8b_02_voice_foundation_v1.sql',
    header: 'FUNCTION account_erasure_private.voice_module_residue_v1(',
    edits: [
      ['      OR EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.user_id = p_user);\n',
       '      OR EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.user_id = p_user)\n'
       + `      -- ${TAG}, §4.6 rule 10)\n`
       + '      OR EXISTS (SELECT 1 FROM voice_private.note_transcriptions n WHERE n.user_id = p_user)\n'
       + '      OR EXISTS (SELECT 1 FROM voice_private.note_transcription_attempts a WHERE a.user_id = p_user);\n'],
    ],
  },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// The header under which a substitution's statement is written in 0186 (a derived function has its own name).
export const writtenHeader = (substitution) => substitution.target ?? substitution.header;

// The 0186 statement for one substitution: the origin statement as CREATE OR REPLACE, each edit applied exactly once.
export function substitutedStatement(substitution) {
  const origin = readFileSync(new URL(substitution.origin, MIGRATIONS), 'utf8');
  let { statement } = extractStatement(origin, substitution.header);
  statement = statement.replace(/^CREATE (?:OR REPLACE )?FUNCTION /u, 'CREATE OR REPLACE FUNCTION ');
  for (const [from, to] of substitution.edits) {
    const n = occurrences(statement, from);
    if (n !== 1) throw new Error(`${substitution.key}: an edit must match exactly once, matched ${n}: ${from.slice(0, 80)}`);
    statement = statement.replace(from, () => to);
  }
  return statement;
}

// The body of one substitution's 0186 statement: what an earlier verifier that pins the function byte-for-byte expects
// once 0186 is applied. Derived from the declared edits, never copied, so an earlier pin and 0186 cannot drift.
export function substitutedBody(key) {
  const substitution = SUBSTITUTIONS.find((s) => s.key === key);
  if (!substitution) throw new Error(`no 0186 substitution named ${key}`);
  return extractStatement(substitutedStatement(substitution), writtenHeader(substitution)).body;
}

// Whether migration 0186 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function voiceNotesApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('voice_private.note_transcriptions') IS NOT NULL AS applied");
  return applied;
}
