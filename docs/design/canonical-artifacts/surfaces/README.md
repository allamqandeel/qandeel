# Surfaces — I-08B3.1-B4R Surface / Content Hierarchy

The canonical Surface production specification and its DTCG token tree.

- `i-08b3.1-b4r/docs/B4_CANONICAL_SURFACE_SPEC.md`: the spec. `B4_SURFACE_ROLE_CONTRACTS.md`
  defines the roles and `B4_SURFACE_EARNING_TEST.md` the earning test.
- `i-08b3.1-b4r/tokens/`: resolver, semantic base, dark and light appearance contexts, contrast
  contexts.
- `i-08b3.1-b4r/schemas/2025.10/`: the vendored DTCG schemas the resolver conforms to.
- `i-08b3.1-b4r/tools/`: validation, invariants and schema conformance.

**Binding later amendment:** G1.1 added a fifth role, `UTTERANCE`, with the alias
`qandeel.role.utterance.fill = {qandeel.surface.functional}` —
`docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md` §3. The preserved B4R
files predate it and still say "four roles". The amendment wins.

Provenance, lifecycle and exclusions: [`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md).
