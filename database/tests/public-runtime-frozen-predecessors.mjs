// I-05B - the frozen predecessor migrations every I-05B contract pins by content.
//
// A plain module rather than a test file: `node:test` registers a file's tests at
// import time, so a contract that imported this list from a sibling CONTRACT would
// re-run that sibling's tests inside its own run. This file registers nothing.
//
// Pinning by content hash proves immutability without banning additions: a later
// migration may add anything beside these; nothing may edit them. The I-05B
// siblings 0094-0097 are deliberately NOT listed - they ship in one PR and a
// sibling's hash is still moving.
export const FROZEN_PREDECESSORS = [
  ['0064_committed_conversational_unit_substrate_v1.sql', '0a2ee63980e59072b3e9f52a643efa8220e95b08'],
  ['0087_shared_world_selective_history_access_v1.sql', '46606903867c8cc3570d61ee068d0baf6b9d65d8'],
  ['0089_shared_world_material_persistence_v1.sql', '82d6d5f0c293528649198efee2305ca0baa7b685'],
  ['0090_shared_world_material_commit_owner_deletion_v1.sql', 'c65bb170449e98454b4ba248dad3793b6ea363f8'],
  ['0091_public_world_experience_identity_foundation_v1.sql', '9fd901f7bbb8f6046af87e6a70bb5b2a0823e5c9'],
  ['0092_public_experience_publication_package_authority_v1.sql', 'c9fb25926dd86127de275a296cf4bbcf04ea5ab9'],
  ['0093_public_experience_review_ready_runtime_v1.sql', 'e9a2d94f9a113f0864b98ab9753ac600afb6300a'],
];
