// I-06B - the merged I-06A migrations every Replay Version contract pins by
// content.
//
// A plain module rather than a test file, for the reason the sibling I-06A list
// records: `node:test` registers a file's tests at import time, so a contract
// that imported this list from another CONTRACT would re-run that contract's
// tests inside its own run and report every result twice.
//
// It is a SEPARATE list from `replay-frozen-predecessors.mjs` rather than an
// addition to it: pinning 0100 and 0101 is an I-06B obligation, and adding them
// to the shared list would change what the merged I-06A contracts assert about
// a tree neither of them owns.
export const I06A_FROZEN = [
  ['0100_replay_foundation_source_manifest_selection_v1.sql', '5fb034265015e5b353a1118db3ed41080880a541'],
  ['0101_replay_authorized_draft_runtime_v1.sql', '01cc9eb759d4ebe8d86eda479e248ddfb7d21259'],
];
