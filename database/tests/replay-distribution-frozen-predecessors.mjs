// I-06C - the merged I-06B migrations every Replay distribution contract pins by
// content.
//
// A plain module rather than a test file, for the reason the sibling I-06A and
// I-06B lists record: `node:test` registers a file's tests at import time, so a
// contract that imported this list from another CONTRACT would re-run that
// contract's tests inside its own run and report every result twice.
//
// It is a SEPARATE list from `replay-version-frozen-predecessors.mjs` rather
// than an addition to it: pinning 0102 and 0103 is an I-06C obligation, and
// adding them to the I-06B list would change what the merged I-06B contracts
// assert about a tree neither of them owns.
export const I06B_FROZEN = [
  ['0102_replay_analytical_projection_render_contract_versioning_v1.sql', '942e60e3f57cecf56e54ed9f176f5926567d488f'],
  ['0103_replay_preview_finalization_runtime_v1.sql', 'b78a3ebc017ba4d428ecd8187b7b93ec7be4c7d9'],
];
