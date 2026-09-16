// I-06A - the frozen predecessor migrations every Replay contract pins by content.
//
// A plain module rather than a test file: `node:test` registers a file's tests at
// import time, so a contract that imported this list from a sibling CONTRACT would
// re-run that sibling's tests inside its own run. This file registers nothing.
//
// Pinning by content hash proves immutability without banning additions: a later
// migration may add anything beside these; nothing may edit them. The Replay
// foundation binds exactly these truths - the committed Personal source and its
// Session Position (0064 / 0065), the Shared history visibility entry point and
// the closed-World branch it delegates to (0087 / 0088), the Shared material
// store and its owner deletion (0089 / 0090), and the whole frozen Public World
// (0091-0099) - so every one of them is pinned here.
export const FROZEN_PREDECESSORS = [
  ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
  ['0065_session_semantic_clock_sp_lh_delivery_v1.sql', '3dc061c71bcb237cec648abb2d1fa02f450cd57f'],
  ['0072_historical_coverage_projection_disclosure_v1.sql', 'c48286e575960ac3693f75b77324597b723089fc'],
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0088_shared_world_standard_closure_v1.sql', 'dff71de8fbfc2f834d2d267949359d2ebbd3effe'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
  ['0091_public_world_experience_identity_foundation_v1.sql', '9fd901f7bbb8f6046af87e6a70bb5b2a0823e5c9'],
  ['0092_public_experience_publication_package_authority_v1.sql', 'c9fb25926dd86127de275a296cf4bbcf04ea5ab9'],
  ['0093_public_experience_review_ready_runtime_v1.sql', 'e9a2d94f9a113f0864b98ab9753ac600afb6300a'],
  ['0094_public_publication_effective_approval_state_v1.sql', '0369e74387b17daaf7343d730c9040b1203a3c09'],
  ['0095_public_experience_publication_visibility_serving_v1.sql', '1932ee0b07d6c3f686ef865975ab77306c6602fb'],
  ['0096_public_semantic_placement_discussion_qandeel_v1.sql', '047136c5c780b7d4d314bc7321fa01621707e1a5'],
  ['0097_public_vitality_search_lens_panel_projections_v1.sql', 'a5c58da00c77d4951da7396bd7d4db7ddc723f71'],
  ['0098_public_continuing_eligibility_visibility_closure_v1.sql', 'eb854567202f7906ba98ae1384493e577704ea4f'],
  ['0099_public_experience_disappearance_runtime_v1.sql', '953d9e91691a48e19d9b7d7e4aef4397f69bc721'],
];
