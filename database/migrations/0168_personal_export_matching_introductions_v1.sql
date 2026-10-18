-- S6-07 (CP4) - Export My Data: the reader's Matching and Introductions data (QAN-BL-PRIV-04).
--
-- Product authority: the S6-07 Final Task Contract; the CP0 report and its review addendum (§3, §4, §9, §10), approved by
-- the Product Owner on 2026-10-18 with Q7' / Q7'' (every derived photo rendition the reader may still retrieve, blurred
-- and clear; the 32 MiB bound a technical guard only) and Q9 (a proposal's arrival is not exported), under CA-EXP; and
-- «S6-07 — CP3 CLOSED / Start CP4» (2026-10-18). GATE-19: the reader's own data, never the other participant's.
--
-- ## What is added
--
--   1. Export My Data (0130, as re-stated by 0153): personal_data_private.build_personal_export_v1 is re-stated with ONE
--      added section, `matchingAndIntroductions`, in readable words, and `notYetIncluded` loses `introductions` (the
--      shared, public and replay categories stay: QAN-BL-PRIV-05). Every other line of the 0153 body is unchanged, and
--      the builder keeps its posture (SECURITY INVOKER, STABLE, search_path '', owner postgres, run only inside
--      prepare_data_exports_v1). The section, every sub-select keyed on p_subject as owner, author, actor or bound
--      recipient:
--        preparation          the reader's draft, declared facts, notes, earlier-understanding decisions, assistance
--                             consents (0154);
--        enrollment           the reader's enrollment acts with the exact consent versions they named (GATE-17), their
--                             participation, context-grant and disclosure-authority events, Introduction Profile and
--                             requirement versions (0108, 0165);
--        confirmedFacts       every confirmed fact version of the reader (0156);
--        proposals            each proposal DELIVERED to the reader (CW2-06 §53): the one neutral word their own screen
--                             shows, and the reader's own decisions - never the arrival instant (Q9), the other human,
--                             a conclusion, a role, a state, a reason or a deadline;
--        introductions        per Introduction: when it started, its state, whether the reader ended it (never who did
--                             otherwise), the reader's own messages (Introduction era), text shares, photo facts, name
--                             display acts and continuation approvals - never the other human's;
--        keptIntroductions    the reader's own words they keep after the other human's account erasure (0164);
--        resumedAfterIntroductions  the reader's own reactivations and releases.
--      An owner-deleted message, share or photo stage has no body and is absent (CW2-08 §2); no digest of anything.
--   2. public.list_my_introduction_photo_renditions_v1() - ONE owner-only STABLE reader for the export download: the
--      caller's OWN photo renditions that still exist (series READY, DISCLOSING or RETIRED), each with the instant its
--      Introduction started (the value the package prints, so the photo manifest joins the package by a value it already
--      carries, never by an identifier), its stage, its handle and whether that stage is currently shared. It adds no
--      authority: the API still asks authorize_my_introduction_media_v1 on the reader's own token for EVERY photo of
--      EVERY download, and only an AUTHORIZED handle reaches server_read_introduction_media_key_v1. No handle, key or
--      World id ever leaves the API. (CP4 finding: no existing reader gives a World's start instant to its human, so the
--      approved manifest join of addendum §10.3 needs this one reader; recorded for the Product Owner as CA-EXP′.)
--
-- ## What is deliberately NOT here
--
--   * No table, column, trigger, policy or registry row: no relation is added, so the account erasure (0164) and its
--     coverage census are unchanged.
--   * No change to 0130 (prepare / read / download), to 0162 (the photo authority, the key reader, the store), or to any
--     Matching or Introductions core, seam, gate or projection. No bytes ever enter PostgreSQL.
--   * No reader over the pair-bound relations (snapshots, hard-requirement results, reasoning notes, conclusions, filter
--     refusals, recipient views, Match handoff packages): none of them is the reader's own data.
--
-- Forward-only. Migrations 0001-0167 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Export My Data: the 0153 body, re-stated with the one added `matchingAndIntroductions` section.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        -- IP-IMP-01 (0153): the owner's four durable interaction preferences, in readable words. No row: all automatic.
        'interactionPreferences', (
            SELECT jsonb_build_object(
                       'replyLength', CASE coalesce(p.reply_length, 'DEFAULT') WHEN 'ALWAYS_BRIEF' THEN 'always brief' ELSE 'automatic' END,
                       'replyLanguage', CASE coalesce(p.reply_language, 'DEFAULT')
                                            WHEN 'EGYPTIAN_ARABIC' THEN 'Egyptian Arabic'
                                            WHEN 'MODERN_STANDARD_ARABIC' THEN 'Modern Standard Arabic'
                                            WHEN 'LEVANTINE_ARABIC' THEN 'Levantine Arabic'
                                            WHEN 'GULF_ARABIC' THEN 'Gulf Arabic'
                                            WHEN 'MAGHREBI_ARABIC' THEN 'Maghrebi Arabic'
                                            WHEN 'ENGLISH' THEN 'English'
                                            ELSE 'automatic' END,
                       'humour', CASE coalesce(p.humour, 'DEFAULT') WHEN 'WELCOME' THEN 'welcome' WHEN 'DECLINED' THEN 'no humour' ELSE 'automatic' END,
                       'explanationStyle', CASE coalesce(p.explanation_style, 'DEFAULT')
                                               WHEN 'SIMPLER' THEN 'simpler'
                                               WHEN 'DIRECT' THEN 'direct'
                                               WHEN 'SIMPLER_AND_DIRECT' THEN 'simple and direct'
                                               ELSE 'automatic' END,
                       'lastChangedAt', p.updated_at)
              FROM (SELECT 1) AS one LEFT JOIN public.interaction_preferences p ON p.user_id = p_subject),
        -- S6-07 (0168): the reader's OWN Matching and Introductions data, in readable words (QAN-BL-PRIV-04, CA-EXP).
        -- Every sub-select is keyed on p_subject as owner, author, actor or bound recipient. Nothing names, quotes or
        -- describes another human; no internal identifier, digest, score, reason, role or proposal state is printed; a
        -- proposal appears only once it was delivered to the reader, and never with the instant it arrived (Q9).
        'matchingAndIntroductions', jsonb_build_object(
            'preparation', jsonb_build_object(
                'draft', (
                    SELECT jsonb_build_object(
                               'shortIntroduction', d.short_introduction,
                               'workField', lower(replace(d.work_field, '_', ' ')),
                               'requirements', jsonb_build_object('answer', lower(replace(d.hard_answer, '_', ' ')), 'items', d.hard_items),
                               'preferences', jsonb_build_object('answer', lower(replace(d.soft_answer, '_', ' ')), 'items', d.soft_items),
                               'skippedSteps', (SELECT coalesce(jsonb_agg(lower(replace(s.step, '_', ' ')) ORDER BY s.step), '[]'::jsonb)
                                                  FROM unnest(d.skipped_steps) AS s(step)),
                               'reviewedAt', d.reviewed_at,
                               'startedAt', d.created_at,
                               'lastChangedAt', d.updated_at)
                      FROM introductions_preparation_private.drafts d WHERE d.user_id = p_subject),
                'declaredFacts', (
                    SELECT jsonb_build_object(
                               'firstName', CASE WHEN f.first_name IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', f.first_name, 'state', lower(f.first_name_state), 'confirmedAt', f.first_name_confirmed_at) END,
                               'sex', CASE WHEN f.sex IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(f.sex), 'state', lower(f.sex_state), 'confirmedAt', f.sex_confirmed_at) END,
                               'birth', CASE WHEN f.birth_year IS NULL THEN NULL ELSE jsonb_build_object(
                                   'year', f.birth_year, 'month', f.birth_month, 'state', lower(f.birth_state), 'confirmedAt', f.birth_confirmed_at) END,
                               'area', CASE WHEN f.country_code IS NULL THEN NULL ELSE jsonb_build_object(
                                   'country', f.country_code, 'region', f.region_code, 'state', lower(f.area_state), 'confirmedAt', f.area_confirmed_at) END,
                               'maritalStatus', CASE WHEN f.marital_status IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(replace(f.marital_status, '_', ' ')), 'state', lower(f.marital_state), 'confirmedAt', f.marital_confirmed_at) END)
                      FROM introductions_preparation_private.declared_facts f WHERE f.user_id = p_subject),
                'notes', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'kind', lower(replace(n.kind, '_', ' ')),
                               'origin', CASE n.origin WHEN 'USER_AUTHORED' THEN 'written by you'
                                                       WHEN 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' THEN 'confirmed by you'
                                                       ELSE 'corrected by you' END,
                               'text', n.body,
                               'writtenAt', n.created_at)
                           ORDER BY n.created_at, n.id)
                      FROM introductions_preparation_private.notes n WHERE n.user_id = p_subject), '[]'::jsonb),
                'earlierUnderstandingDecisions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('decision', lower(replace(p.decision, '_', ' ')), 'decidedAt', p.decided_at)
                           ORDER BY p.decided_at, p.memory_id)
                      FROM introductions_preparation_private.prior_understanding_decisions p WHERE p.user_id = p_subject), '[]'::jsonb),
                'assistanceConsents', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('version', c.consent_version, 'givenAt', c.granted_at, 'withdrawnAt', c.revoked_at)
                           ORDER BY c.granted_at, c.id)
                      FROM introductions_preparation_private.assistance_consents c WHERE c.user_id = p_subject), '[]'::jsonb)),
            'enrollment', jsonb_build_object(
                'acts', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', CASE a.act_kind WHEN 'ENROLL' THEN 'enrolled' WHEN 'CORRECTION' THEN 'corrected'
                                                      WHEN 'RESUME' THEN 'resumed' ELSE 'consent given again' END,
                               'at', a.committed_at,
                               'reviewedDraftVersion', a.draft_version,
                               'consentVersions', jsonb_build_object(
                                   'participation', a.participation_consent_version,
                                   'contextGrant', a.context_consent_version,
                                   'disclosureAuthority', a.disclosure_consent_version))
                           ORDER BY a.committed_at, a.command_id)
                      FROM matching_enrollment_private.enrollment_acts a WHERE a.user_id = p_subject), '[]'::jsonb),
                'participation', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', lower(replace(e.participation_act, '_', ' ')),
                               'state', lower(e.resulting_state),
                               'pauseReason', lower(replace(e.resulting_pause_reason, '_', ' ')),
                               'entry', lower(replace(e.activation_entry_channel, '_', ' ')),
                               'at', e.occurred_at)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.matching_participation_events e WHERE e.participant_user_id = p_subject), '[]'::jsonb),
                'contextGrant', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('event', lower(e.event_type), 'at', e.occurred_at) ORDER BY e.occurred_at, e.id)
                      FROM public.matching_context_consent_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'disclosureAuthority', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'event', lower(e.event_type),
                               'at', e.occurred_at,
                               'approvedFields', CASE WHEN e.event_type = 'REVOKED' THEN NULL ELSE coalesce((
                                   SELECT jsonb_agg(lower(replace(af.field_key, '_', ' ')) ORDER BY af.field_key)
                                     FROM public.pre_match_disclosure_authority_fields af
                                    WHERE af.authority_id = e.subject_authority_id), '[]'::jsonb) END)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.pre_match_disclosure_authority_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'introductionProfileVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'fields', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object('field', lower(replace(fv.field_key, '_', ' ')), 'value', fv.field_value)
                                          ORDER BY fv.field_key)
                                     FROM public.introduction_profile_field_values fv WHERE fv.profile_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.introduction_profile_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb),
                'requirementVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'items', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object(
                                              'requirement', lower(replace(i.requirement_key, '_', ' ')),
                                              'strength', CASE i.requirement_strength WHEN 'HARD_DEALBREAKER' THEN 'required' ELSE 'preferred' END,
                                              'value', i.requirement_value)
                                          ORDER BY i.requirement_strength, i.requirement_key)
                                     FROM public.matching_requirement_items i WHERE i.requirement_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.matching_requirement_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb)),
            'confirmedFacts', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'firstName', f.first_name,
                           'sex', lower(f.sex),
                           'birthYear', f.birth_year,
                           'birthMonth', f.birth_month,
                           'country', f.country_code,
                           'region', f.region_code,
                           'maritalStatus', lower(replace(f.marital_status, '_', ' ')),
                           'confirmedAt', jsonb_build_object(
                               'firstName', f.first_name_confirmed_at, 'sex', f.sex_confirmed_at, 'birth', f.birth_confirmed_at,
                               'area', f.area_confirmed_at, 'maritalStatus', f.marital_confirmed_at),
                           'recordedAt', f.recorded_at)
                       ORDER BY f.recorded_at, f.id)
                  FROM public.matching_confirmed_fact_versions f WHERE f.owner_user_id = p_subject), '[]'::jsonb),
            -- A proposal only once it was DELIVERED to the reader (CW2-06 §53): the one neutral word their own proposal
            -- screen shows (resolve_my_matching_proposal_presentation_v1's mapping, a live one past its deadline or no
            -- longer valid included) and the reader's own decisions. Never the other human, a conclusion, a role, a
            -- state, a reason, a deadline or when it arrived.
            'proposals', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'outcome', (
                               SELECT CASE CASE WHEN n.neutral_outcome NOT IN ('AWAITING_YOU', 'IN_PROGRESS') THEN n.neutral_outcome
                                                WHEN p.expires_at <= clock_timestamp() THEN 'NO_LONGER_AVAILABLE'
                                                WHEN (SELECT v.still_valid FROM public.resolve_matching_proposal_validity_v1(p.id) v) IS NOT TRUE
                                                  THEN 'NO_LONGER_AVAILABLE'
                                                ELSE n.neutral_outcome END
                                        WHEN 'AWAITING_YOU' THEN 'awaiting you'
                                        WHEN 'IN_PROGRESS' THEN 'in progress'
                                        WHEN 'CLOSED_BY_YOU' THEN 'closed by you'
                                        WHEN 'MATCH_CONCLUDED' THEN 'matched'
                                        ELSE 'no longer available' END
                                 FROM public.matching_proposals p
                                 CROSS JOIN LATERAL public.resolve_matching_proposal_neutral_outcome_v1(p.id, p_subject) n
                                WHERE p.id = x.proposal_id),
                           'yourDecisions', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('decision', own.decision, 'at', own.at) ORDER BY own.at, own.decision)
                                 FROM (SELECT 'approved'::text AS decision, fa.bound_at AS at
                                         FROM public.matching_forward_approval_view_bindings fa
                                        WHERE fa.proposal_id = x.proposal_id AND fa.approver_user_id = p_subject
                                       UNION ALL
                                       SELECT CASE db.decision_state WHEN 'WITHDRAWN' THEN 'withdrawn' ELSE 'declined' END, db.bound_at
                                         FROM public.matching_proposal_decision_view_bindings db
                                        WHERE db.proposal_id = x.proposal_id AND db.decider_user_id = p_subject
                                       UNION ALL
                                       SELECT 'accepted', mc.committed_at
                                         FROM public.matching_match_commits mc
                                        WHERE mc.proposal_id = x.proposal_id AND mc.candidate_user_id = p_subject) own), '[]'::jsonb))
                       ORDER BY x.first_delivered, x.proposal_id)
                  FROM (SELECT b.proposal_id, min(b.bound_at) AS first_delivered
                          FROM public.matching_proposal_delivery_view_bindings b
                         WHERE b.recipient_user_id = p_subject
                         GROUP BY b.proposal_id) x), '[]'::jsonb),
            -- Each Introduction the reader is one of the two humans of: what the reader themselves wrote, shared and
            -- decided in it - never the other human's words, shares, photo or name, and never who ended it when the
            -- reader did not. Messages are the Introduction era only (after a valid SUCCESS the World is a Shared World,
            -- whose export is QAN-BL-PRIV-05's). A message, share or stage its owner deleted has no body and is absent.
            'introductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', r.started_at,
                           'state', CASE r.introduction_status WHEN 'ACTIVE' THEN 'active'
                                                               WHEN 'COMPLETED' THEN 'continued as a shared world'
                                                               ELSE 'ended' END,
                           'endedAt', CASE WHEN r.introduction_status = 'CLOSED' THEN r.ended_at END,
                           'endedByYou', CASE WHEN r.introduction_status = 'CLOSED' THEN EXISTS (
                               SELECT 1 FROM public.introduction_ended_events e
                                WHERE e.introduction_record_id = r.id AND e.actor_user_id = p_subject) END,
                           'continuedAt', CASE WHEN r.introduction_status = 'COMPLETED' THEN r.ended_at END,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.shared_world_materials m
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE m.world_id = r.world_id AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'
                                  AND shared_private.is_introduction_era_history_item_v1(m.world_id, m.history_item_id)), '[]'::jsonb),
                           'yourShares', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'kind', lower(replace(v.resource_type, '_', ' ')),
                                          'field', lower(replace(t.field_key, '_', ' ')),
                                          'text', t.text_value,
                                          'sharedAt', v.established_at)
                                      ORDER BY v.established_at, v.id)
                                 FROM public.introduction_disclosure_resource_versions v
                                 JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id
                                WHERE v.introduction_record_id = r.id AND v.world_id = r.world_id AND v.owner_user_id = p_subject), '[]'::jsonb),
                           -- The reader's own photo: its state and the derived renditions that still exist (the upload itself
                           -- is never stored), each stage shared or not; the files themselves travel beside the package.
                           'yourPhotos', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'state', CASE WHEN s.series_state IN ('READY', 'DISCLOSING') THEN 'live'
                                                        WHEN EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions kept
                                                                      WHERE kept.series_id = s.id) THEN 'shared'
                                                        ELSE 'removed' END,
                                          'stages', coalesce((
                                              SELECT jsonb_agg(jsonb_build_object('stage', rr.stage, 'shared', vis.at IS NOT NULL, 'sharedAt', vis.at)
                                                     ORDER BY rr.stage)
                                                FROM introduction_sharing_private.image_renditions rr
                                                LEFT JOIN LATERAL (
                                                    SELECT dv.established_at AS at
                                                      FROM introduction_sharing_private.image_stage_disclosures sd
                                                      JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = sd.resource_version_id
                                                      JOIN public.introduction_disclosure_resource_versions dv ON dv.id = sd.resource_version_id
                                                     WHERE sd.series_id = rr.series_id AND sd.stage = rr.stage) vis ON true
                                               WHERE rr.series_id = s.id), '[]'::jsonb))
                                      ORDER BY (s.series_state IN ('READY', 'DISCLOSING')), s.id)
                                 FROM introduction_sharing_private.image_series s
                                WHERE s.introduction_record_id = r.id AND s.world_id = r.world_id AND s.owner_user_id = p_subject
                                  AND s.series_state <> 'PENDING'), '[]'::jsonb),
                           'yourNameDisplay', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.display_act WHEN 'GRANT' THEN 'full name shown' ELSE 'first name shown again' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM introduction_sharing_private.name_display_events e
                                WHERE e.world_id = r.world_id AND e.owner_user_id = p_subject), '[]'::jsonb),
                           'yourContinuationApprovals', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.approval_act WHEN 'APPROVE' THEN 'approved' ELSE 'approval withdrawn' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM public.introduction_success_approval_events e
                                 JOIN public.introduction_success_transition_versions tv ON tv.id = e.transition_version_id
                                WHERE tv.introduction_record_id = r.id AND e.approver_user_id = p_subject), '[]'::jsonb))
                       ORDER BY r.started_at, r.world_id)
                  FROM public.introduction_records r WHERE p_subject IN (r.lower_user_id, r.higher_user_id)), '[]'::jsonb),
            -- An ended Introduction whose other human erased their account: the reader's own words they keep (0164).
            'keptIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', w.born_at,
                           'state', 'ended',
                           'keptAt', rv.retained_at,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.introduction_retained_view_items it
                                 JOIN public.shared_world_materials m ON m.history_item_id = it.history_item_id AND m.world_id = it.world_id
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE it.world_id = rv.world_id AND it.user_id = p_subject
                                  AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'), '[]'::jsonb))
                       ORDER BY w.born_at, rv.world_id)
                  FROM public.introduction_retained_views rv
                  JOIN public.shared_worlds w ON w.id = rv.world_id
                 WHERE rv.user_id = p_subject), '[]'::jsonb),
            'resumedAfterIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('act', own.act, 'at', own.at) ORDER BY own.at, own.act)
                  FROM (SELECT lower(c.reactivation_act) AS act, c.committed_at AS at
                          FROM public.matching_introduction_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT lower(c.reactivation_act), c.committed_at
                          FROM public.matching_counterpart_erasure_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT 'free to resume', rl.released_at
                          FROM public.matching_counterpart_erasure_releases rl WHERE rl.participant_user_id = p_subject) own), '[]'::jsonb)),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'));
$$;

ALTER FUNCTION personal_data_private.build_personal_export_v1(uuid) OWNER TO postgres;
-- CREATE OR REPLACE keeps the ACL; it is revoked again explicitly so no default privilege can ever reach the builder.
REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM PUBLIC;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION personal_data_private.build_personal_export_v1(uuid) FROM service_role; END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The export download's one owner-only reader of the caller's own photo renditions.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.list_my_introduction_photo_renditions_v1()
RETURNS TABLE(world_id uuid, introduction_started_at timestamptz, stage integer, media_handle uuid, is_shared boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- The caller's OWN series only, of an Introduction Record the caller is one of the two humans of; a series still being
  -- uploaded (PENDING) or discarded holds nothing to export. Shared = the stage's disclosure still has its payload.
  RETURN QUERY
    SELECT s.world_id, r.started_at, rr.stage::integer, rr.handle,
           EXISTS (SELECT 1 FROM introduction_sharing_private.image_stage_disclosures sd
                     JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = sd.resource_version_id
                    WHERE sd.series_id = rr.series_id AND sd.stage = rr.stage)
      FROM introduction_sharing_private.image_series s
      JOIN public.introduction_records r ON r.id = s.introduction_record_id AND r.world_id = s.world_id
      JOIN introduction_sharing_private.image_renditions rr ON rr.series_id = s.id
     WHERE s.owner_user_id = v_user
       AND v_user IN (r.lower_user_id, r.higher_user_id)
       AND s.series_state IN ('READY', 'DISCLOSING', 'RETIRED')
     ORDER BY r.started_at, s.world_id, rr.stage;
END$$;

COMMENT ON FUNCTION public.list_my_introduction_photo_renditions_v1() IS
  'S6-07 (CP4, QAN-BL-PRIV-04): the caller''s OWN Introduction photo renditions that still exist, each with the instant '
  'its Introduction started, its stage, its handle and whether it is shared now - for the Export My Data download only, '
  'which still authorizes every photo on the caller''s token (authorize_my_introduction_media_v1). Never another '
  'human''s. authenticated only.';

ALTER FUNCTION public.list_my_introduction_photo_renditions_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_my_introduction_photo_renditions_v1() FROM PUBLIC;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.list_my_introduction_photo_renditions_v1() FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.list_my_introduction_photo_renditions_v1() FROM service_role; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.list_my_introduction_photo_renditions_v1() FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.list_my_introduction_photo_renditions_v1() TO authenticated; END IF;
END$$;

COMMIT;
