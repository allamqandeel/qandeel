// I-05B / I-05C - the frozen predecessor migrations every Public World contract
// pins by content.
//
// A plain module rather than a test file: `node:test` registers a file's tests at
// import time, so a contract that imported this list from a sibling CONTRACT would
// re-run that sibling's tests inside its own run. This file registers nothing.
//
// Pinning by content hash proves immutability without banning additions: a later
// migration may add anything beside these; nothing may edit them.
//
// The whole I-05B set 0094-0097 is listed now that it is merged and frozen on
// canonical main: when I-05B shipped, a sibling's hash was still moving inside
// its own PR, which is why it was deliberately absent then. The I-05C siblings
// 0098-0099 are absent for exactly that reason today.
export const FROZEN_PREDECESSORS = [
  ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
  ['0091_public_world_experience_identity_foundation_v1.sql', '9fd901f7bbb8f6046af87e6a70bb5b2a0823e5c9'],
  ['0092_public_experience_publication_package_authority_v1.sql', 'c9fb25926dd86127de275a296cf4bbcf04ea5ab9'],
  ['0093_public_experience_review_ready_runtime_v1.sql', 'e9a2d94f9a113f0864b98ab9753ac600afb6300a'],
  ['0094_public_publication_effective_approval_state_v1.sql', '0369e74387b17daaf7343d730c9040b1203a3c09'],
  ['0095_public_experience_publication_visibility_serving_v1.sql', '1932ee0b07d6c3f686ef865975ab77306c6602fb'],
  ['0096_public_semantic_placement_discussion_qandeel_v1.sql', '047136c5c780b7d4d314bc7321fa01621707e1a5'],
  ['0097_public_vitality_search_lens_panel_projections_v1.sql', 'a5c58da00c77d4951da7396bd7d4db7ddc723f71'],
];
