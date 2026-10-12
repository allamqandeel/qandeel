// MEM-AR-01C (migration 0152, Task Contract §10.3 K-1 and review correction RC-1) - the ONE fixture-attribution helper
// for historical database verifiers.
//
// After 0152 a Memory is personal Evidence only when it is attributed SELF (CC-M1). A verifier that writes a fixture
// Memory directly as the table owner, and then cites it as Evidence, therefore attributes that fixture once, here:
//   * only an ELIGIBLE fixture - an ACTIVE, user-relative Memory the verifier actually cites as Evidence - is attributed;
//     a fixture whose UNATTRIBUTED, OTHER, withdrawn or corrected state is the point of an assertion is left alone;
//   * it runs right after the Memory is written and BEFORE any Hypothesis links it: the 0152 insert guard refuses an
//     attribution on a row that is already linked, already withdrawn or no longer ACTIVE, so a late call fails loudly
//     instead of silently changing what an earlier assertion meant;
//   * it writes as the migration owner (the verifier's own connection), never through an application role or a
//     production writer, and records no command or execution (EXPLICIT_STATEMENT with null provenance ids is lawful).
// No historical expectation changes because of it: the fixture is exactly as eligible as it was before 0152.

export async function attributeFixtureSelf(client, memoryId, userId) {
  await client.query(
    `INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis)
     VALUES ($1, $2, 'SELF', 'EXPLICIT_STATEMENT')`,
    [memoryId, userId],
  );
}
