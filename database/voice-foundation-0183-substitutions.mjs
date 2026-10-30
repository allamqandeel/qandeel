// S8B-02 CP1 (migration 0183): the exact edits 0183 makes to the functions it forward-replaces.
//
// Every function 0183 re-creates is its origin migration's statement, verbatim, with only the edits listed here (the
// 0150 precedent). `CREATE FUNCTION` becomes `CREATE OR REPLACE FUNCTION`, so the signature, owner and ACL are kept.
// verify-migration-0183 re-derives each statement from its origin file and these edits. It requires the result to equal
// the statement written in 0183, and the live `prosrc` to equal that statement's body. Nothing here is generated at
// deploy time; this module is the reviewable statement of the diff.
import { readFileSync } from 'node:fs';

const MIGRATIONS = new URL('./migrations/', import.meta.url);

// The comment lines every edit adds start with this tag, so a reader of the live body can find them.
const TAG = 'S8B-02 (0183';

export const SUBSTITUTIONS = [
  {
    key: 'live-producer',
    origin: '0071_effective_live_focus_final_semantic_chain_cutover_v1.sql',
    header: 'FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(',
    edits: [
      ["  derived_modality constant text := 'TEXT';\n", "  derived_modality text := 'TEXT';\n"],
      ["  IF session_row.channel <> 'TEXT' THEN\n    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';\n  END IF;\n",
       "  IF session_row.channel <> 'TEXT' THEN\n    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';\n  END IF;\n"
       + `  -- ${TAG}, VA-3): the modality is the turn's voice source, read under the turn lock; a turn with none is TEXT.\n`
       + '  SELECT vs.source_modality INTO derived_modality FROM public.conversation_turn_voice_sources vs\n'
       + '   WHERE vs.turn_id = turn_row.id FOR KEY SHARE;\n'
       + "  IF NOT FOUND THEN derived_modality := 'TEXT'; END IF;\n"],
    ],
  },
  {
    key: 'memory-shape',
    origin: '0026_memory_authority_hardening_v1.sql',
    header: 'FUNCTION public.assert_canonical_memory_shape_v1(',
    edits: [
      ["    'USER_STATED','USER_CONFIRMED','SYSTEM_DERIVED','IMPORTED','ADMIN_CONTROLLED'\n  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_SOURCE'",
       "    'USER_STATED','USER_CONFIRMED','SYSTEM_DERIVED','IMPORTED','ADMIN_CONTROLLED','MACHINE_ASR'\n  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_SOURCE'"],
    ],
  },
  {
    key: 'background-memory-writer',
    origin: '0152_memory_subject_identity_atomicity_v1.sql',
    header: 'FUNCTION public.background_record_memory_v1(',
    edits: [
      ['  created public.memories;\nBEGIN\n',
       "  created public.memories;\n  v_band text;\n  v_source text := 'USER_STATED';\nBEGIN\n"],
      ["  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       `  -- ${TAG}, D-7 / P-1): a turn with a voice source is a machine transcript. Its source is read from the turn, never\n`
       + '  -- taken from the caller. A LOW band writes no Memory. Any other band is recorded MACHINE_ASR, below the typed-text\n'
       + "  -- confidence; the band's value is controlled configuration.\n"
       + '  SELECT vs.asr_confidence_band INTO v_band FROM public.conversation_turn_voice_sources vs\n'
       + '   WHERE vs.turn_id = p_source_turn_id AND vs.user_id = execution_row.user_id;\n'
       + '  IF FOUND THEN\n'
       + "    IF v_band IS DISTINCT FROM 'HIGH' AND v_band IS DISTINCT FROM 'MEDIUM' THEN\n"
       + "      RETURN QUERY SELECT 'LOW_CONFIDENCE_MACHINE_ASR'::text, NULL::uuid; RETURN;\n"
       + '    END IF;\n'
       + '    IF p_confidence IS NULL OR NOT (p_confidence < 0.95) THEN\n'
       + "      RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023';\n"
       + '    END IF;\n'
       + "    v_source := 'MACHINE_ASR';\n"
       + '  END IF;\n'
       + "  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
      ["    'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);\n",
       "    v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);\n"],
    ],
  },
  {
    key: 'public-authoring-picker',
    origin: '0175_s8a_04_shared_social_memory_v1.sql',
    header: 'FUNCTION public_authoring_private.list_own_public_authoring_sources_v1(',
    edits: [
      ["     WHERE cu.user_id = v_user AND cu.source_role = 'USER'\n",
       "     WHERE cu.user_id = v_user AND cu.source_role = 'USER'\n"
       + `       -- ${TAG}, D-7): a voice-sourced unit is not a direct text source of the Public World.\n`
       + '       AND NOT EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = cu.source_turn_id)\n'],
    ],
  },
  {
    key: 'public-authoring-package',
    origin: '0175_s8a_04_shared_social_memory_v1.sql',
    header: 'FUNCTION public_authoring_private.prepare_own_public_experience_package_v1(',
    edits: [
      ['    SELECT d.outcome, d.item_count, d.required_approver_count INTO r\n',
       `    -- ${TAG}, D-7): a voice-sourced Personal unit is not a direct text source of the Public World. It is refused\n`
       + '    -- with the class a source this human cannot see gets.\n'
       + '    IF EXISTS (SELECT 1 FROM public.conversation_units cu\n'
       + '                 JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id\n'
       + '                WHERE cu.id = ANY (p_personal_unit_ids)) THEN\n'
       + "      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';\n"
       + '    END IF;\n'
       + '    SELECT d.outcome, d.item_count, d.required_approver_count INTO r\n'],
    ],
  },
  {
    key: 'replay-capture',
    origin: '0175_s8a_04_shared_social_memory_v1.sql',
    header: 'FUNCTION public.replay_capture_source_manifest_v1(',
    edits: [
      ["           'MY_WORLD', 'ORIGINAL_TEXT',\n",
       `           -- ${TAG}, R-1): the medium is the unit's turn's; a transcript is never ORIGINAL_TEXT.\n`
       + "           'MY_WORLD', voice_private.turn_original_medium_v1(cu.source_turn_id),\n"],
    ],
  },
  {
    key: 'replay-moments',
    origin: '0169_replay_personal_secure_integration_erasure_v1.sql',
    header: 'FUNCTION replay_private.read_my_replay_moments_v1(',
    edits: [
      ["           CASE WHEN v_view.viewing_state = 'VIEWABLE' AND si.anchor_kind = 'WHOLE_ITEM'\n",
       "           CASE WHEN v_view.viewing_state = 'VIEWABLE' AND si.anchor_kind = 'WHOLE_ITEM'\n"
       + `                     -- ${TAG}, R-1): a transcript is a derived transcript, never the source text.\n`
       + "                     AND mi.original_medium = 'ORIGINAL_TEXT'\n"],
    ],
  },
  {
    key: 'public-compose-outcome',
    origin: '0180_s8a_05_publish_from_qandeel_v1.sql',
    header: 'FUNCTION public_compose_source_private.draft_source_outcome_v1(',
    edits: [
      ["    IF v_range.outcome IS DISTINCT FROM 'RESOLVED' THEN\n      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;\n      RETURN;\n    END IF;\n",
       "    IF v_range.outcome IS DISTINCT FROM 'RESOLVED' THEN\n      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;\n      RETURN;\n    END IF;\n"
       + `    -- ${TAG}, D-7): a range holding a voice-sourced unit is not a direct text source of the Public World. It\n`
       + '    -- answers the one SOURCE_UNAVAILABLE, indistinguishable from any other unavailable source.\n'
       + '    IF EXISTS (SELECT 1 FROM public.conversation_units cu\n'
       + '                 JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id\n'
       + '                WHERE cu.session_id = p_draft.source_session_id AND cu.user_id = p_user\n'
       + '                  AND cu.session_position BETWEEN p_draft.source_first_sp AND p_draft.source_last_sp) THEN\n'
       + "      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;\n"
       + '      RETURN;\n'
       + '    END IF;\n'],
    ],
  },
  {
    key: 'personal-export',
    origin: '0180_s8a_05_publish_from_qandeel_v1.sql',
    header: 'FUNCTION personal_data_private.build_personal_export_v1(',
    edits: [
      ["                                      'state', lower(t.status))\n                                  ORDER BY t.created_at, t.id)\n",
       "                                      'state', lower(t.status))\n"
       + `                                  -- ${TAG}, D-7): a voice turn says what it is: a machine transcript, its source\n`
       + '                                  -- and its band. A text turn gains nothing.\n'
       + '                                  || coalesce((SELECT jsonb_strip_nulls(jsonb_build_object(\n'
       + "                                                 'modality', CASE vs.source_modality WHEN 'VOICE_NOTE' THEN 'voice note'\n"
       + "                                                                                     ELSE 'live call' END,\n"
       + "                                                 'transcriptOrigin', vs.transcript_origin,\n"
       + "                                                 'confidenceBand', lower(vs.asr_confidence_band)))\n"
       + '                                         FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = t.id), \'{}\'::jsonb)\n'
       + '                                  ORDER BY t.created_at, t.id)\n'],
      ["        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));\n$$;",
       "        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'))\n"
       + `    -- ${TAG}, D-7): the retained voice recordings, as metadata only (no key, no audio). An account with none\n`
       + '    -- gains nothing, so its document is unchanged; the files themselves are CP2\'s per-file route.\n'
       + '    || CASE WHEN EXISTS (SELECT 1 FROM voice_private.recordings r\n'
       + "                          WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')\n"
       + '                            AND clock_timestamp() < r.retention_expires_at)\n'
       + "       THEN jsonb_build_object('voiceRecordings', (\n"
       + '              SELECT jsonb_agg(jsonb_build_object(\n'
       + "                         'kind', CASE r.recording_kind WHEN 'VOICE_NOTE' THEN 'voice note' ELSE 'live call' END,\n"
       + "                         'recordedAt', coalesce(r.accepted_at, r.started_at),\n"
       + "                         'availableUntil', r.retention_expires_at,\n"
       + "                         'state', CASE r.recording_state WHEN 'STORED' THEN 'stored' ELSE 'recording' END)\n"
       + '                     ORDER BY coalesce(r.accepted_at, r.started_at), r.id)\n'
       + '                FROM voice_private.recordings r\n'
       + "               WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')\n"
       + '                 AND clock_timestamp() < r.retention_expires_at))\n'
       + "       ELSE '{}'::jsonb END;\n$$;"],
    ],
  },
  {
    key: 'account-erasure',
    origin: '0169_replay_personal_secure_integration_erasure_v1.sql',
    header: 'FUNCTION account_erasure_private.erase_account_v1(',
    edits: [
      ['    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;\n',
       `    -- ${TAG}): the account's voice recordings, ascending, before the account row.\n`
       + '    PERFORM 1 FROM voice_private.recordings r WHERE r.user_id = v_user ORDER BY r.id FOR UPDATE;\n'
       + '    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;\n'],
      ["    IF account_erasure_private.replay_module_residue_v1(v_user) THEN\n      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n    END IF;\n",
       "    IF account_erasure_private.replay_module_residue_v1(v_user) THEN\n      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n    END IF;\n"
       + `    -- ${TAG}): the voice module, under the same authorization, before 0130 deletes the turns it names.\n`
       + '    PERFORM account_erasure_private.erase_voice_v1(p_deletion_id, v_user);\n'
       + '    IF account_erasure_private.voice_module_residue_v1(v_user) THEN\n'
       + "      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';\n"
       + '    END IF;\n'],
    ],
  },
];

const occurrences = (text, needle) => text.split(needle).length - 1;

// The statement that defines `header` in `sql`: from its CREATE to the `;` after the closing dollar tag.
export function extractStatement(sql, header) {
  const at = sql.search(new RegExp(`CREATE (?:OR REPLACE )?${header.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'));
  if (at < 0) throw new Error(`no statement for ${header}`);
  const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(sql.slice(at));
  if (!open) throw new Error(`no body for ${header}`);
  const bodyStart = at + open.index + open[0].length;
  const bodyEnd = sql.indexOf(open[1], bodyStart);
  const end = sql.indexOf(';', bodyEnd + open[1].length);
  return { statement: sql.slice(at, end + 1), body: sql.slice(bodyStart, bodyEnd) };
}

// The 0183 statement for one substitution: the origin statement as CREATE OR REPLACE, each edit applied exactly once.
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

// The body of one substitution's 0183 statement: what an earlier verifier that pins the function byte-for-byte expects
// once 0183 is applied. It is derived from the declared edits, never copied, so an earlier pin and 0183 cannot drift.
export function substitutedBody(key) {
  const substitution = SUBSTITUTIONS.find((s) => s.key === key);
  if (!substitution) throw new Error(`no 0183 substitution named ${key}`);
  return extractStatement(substitutedStatement(substitution), substitution.header).body;
}

// Whether migration 0183 is applied to the database `rows` reads (the probe every re-anchored verifier uses).
export async function voiceFoundationApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('public.conversation_turn_voice_sources') IS NOT NULL AS applied");
  return applied;
}
