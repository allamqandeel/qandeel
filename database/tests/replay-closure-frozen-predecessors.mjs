// I-06D - the merged I-06C migrations every Replay closure contract pins by
// content.
//
// A plain module rather than a test file, for the reason the sibling I-06A,
// I-06B and I-06C lists record: `node:test` registers a file's tests at import
// time, so a contract that imported this list from another CONTRACT would re-run
// that contract's tests inside its own run and report every result twice.
//
// It is a SEPARATE list from `replay-distribution-frozen-predecessors.mjs`
// rather than an addition to it: pinning 0104 and 0105 is an I-06D obligation,
// and adding them to the I-06C list would change what the merged I-06C contracts
// assert about a tree neither of them owns.
//
// Pinning by content hash proves immutability without banning additions: 0107
// legitimately ADDS one trivially-unique candidate key to
// `replay_distribution_package_versions`, which changes no byte of the migration
// that created it. What these hashes forbid is editing 0104 or 0105 themselves.
export const I06C_FROZEN = [
  ['0104_replay_distribution_package_authority_v1.sql', '359ef107ab8ebe6888e8c545a2b8f0fe98cbec79'],
  ['0105_replay_distribution_runtime_export_public_bridge_v1.sql', 'b61deb0f83a08e28af61631b4b78fab30dc29d8e'],
];
