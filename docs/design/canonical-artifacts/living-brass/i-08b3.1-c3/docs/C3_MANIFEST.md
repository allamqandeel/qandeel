# C3_MANIFEST

**I-08B3.1-C3.** Every shipped file, hashed. **GENERATED** last, from a walk of the package, so
it describes what is actually there rather than what was intended to be.

**78 files · 2,133,088 bytes.**

| Directory | Files |
|---|---|
| `data` | 3 |
| `docs` | 15 |
| `reference/canonical` | 1 |
| `review/proof` | 9 |
| `tokens` | 1 |
| `tokens/appearance` | 2 |
| `tokens/base` | 1 |
| `tools` | 10 |
| `vendor/b4r` | 6 |
| `vendor/c2` | 6 |
| `vendor/reference/canonical` | 1 |
| `vendor/schemas/2025.10` | 3 |
| `vendor/schemas/2025.10/format` | 4 |
| `vendor/schemas/2025.10/format/values` | 13 |
| `vendor/schemas/2025.10/resolver` | 3 |

---

## Packaging rules, enforced rather than reported

**No font binary.** The package is scanned on every manifest build and the build throws if one is
found. The Arabic face is a LOCAL RUNTIME DEPENDENCY — referenced, hashed before use, never
redistributed. Invariant I-18 scans independently.

**No work directory inside the package.** `.i08b31-c2-work/`: present with 0 entries, EXCLUDED from the package and removed.

That directory is created by importing the vendored C2 renderer, which computes its scratch path
from its own module URL — and the vendored copy lives inside this package. It is a real
consequence of vendoring, it is harmless, and it is asserted and excluded here rather than
quietly deleted and forgotten. C3's own renderer writes outside the package, to
`../.i08b31-c3-work/`.

---

## Predecessors, re-verified untouched

| Package | Bytes | SHA-256 |
|---|---|---|
| `I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION.zip` | 11,763,945 | `c4787a1dcecd0a71ee32a5f0cc2fdeeaa699b137d0cda599f79c542b0f663c0d` |
| `I-08B3.1-C1R-LIVING-BRASS-BODY-PRESENCE-RESOLUTION.zip` | 9,184,957 | `d3d5ffb40790b98cf82221d5b0959ad08a1afbc4e2abb16d241eefb19c76fd3b` |
| `I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL.zip` | 2,202,819 | `68fb674ba392cf308f86f6c4f05cb6a68c94607c9e59349f737f39ad9728ee76` |

---

## Files

| Path | Bytes | SHA-256 | What it is |
|---|---|---|---|
| `data/C3_MANIFEST.json` | 18709 | `799047099200fc3fe436aca3476343d124a30bbb659ade08abe7bc73c7a20dc3` | generated data |
| `data/C3_MEASUREMENTS.csv` | 10544 | `eadc6027d7dcd4c11e39445137ab8b20eeef7c9e0551ab72b7639e352698ed95` | generated data |
| `data/C3_VALIDATION.json` | 98771 | `960d17c1f25646cf70bcf3fbe5e6640a0378b85c18b7425b99c9c133a03c5649` | generated data |
| `docs/C3_ANTI_MINIMALISM_MISREAD.md` | 5365 | `d73d2e8721e0b9ada4060662c4d478c427ce0389bc5fe24f76fe24fc19d0039d` | document |
| `docs/C3_CANONICAL_LIVING_BRASS_SPEC.md` | 9868 | `e9650778ffbeee0a203d703c23be61d40baf5d21b1d0d3d436fbc57d88351bc9` | document |
| `docs/C3_EXPRESSIVE_HEADROOM_CONTRACT.md` | 5343 | `51a09b63591c4edadcd80efb819c48006a9d280785f7fafdaa5259d9d8cc9687` | document |
| `docs/C3_FREEZE_RECORD.md` | 9726 | `1f02ed4d65f94086e3320a856d13c835441ab5bfa5a44ee38f6ace35d6eae7ee` | document |
| `docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` | 10460 | `9f4aca9c23bf0bd83559c63f98a155b55ef681e8fe8ec6b7210d6bafa5364e72` | document |
| `docs/C3_INVARIANTS.md` | 10301 | `28de7da290c39ebf9b90f912f9805a6d86a439ba7b86a5558b0d183cc15e83d0` | document |
| `docs/C3_LUXURY_BOUNDARY.md` | 6502 | `d06f3e865ea4fa286547ad05d24652fda377349ccbc8855c233ada8a1256ad6b` | document |
| `docs/C3_PROOF_TO_PRODUCTION_MAP.md` | 7359 | `461864d256e5fd3c30fe49ef498ae634e303dbd0d92d5a6fcd75d70839221d0a` | document |
| `docs/C3_REACT_NATIVE_MAPPING.md` | 10211 | `7d65a8531e204e663b73377c4ef4b274e1da5797bad771ebf28dfa22ec39f142` | document |
| `docs/C3_README.md` | 9213 | `01761e8bd8902ff469831a64abc19600322c91f3db5eae039de2b1c5bb817ecd` | document |
| `docs/C3_REFERENCE_GATE.md` | 15034 | `54f49f319886080a1ff0d7926fe44f89e6b58ae4178b8126724e9357fe9b212c` | document |
| `docs/C3_SKILL_GATE.md` | 11987 | `247869fe4b4338e831f51c9035b93d747708f7b59e11df3e4120a933314b5eec` | document |
| `docs/C3_TOKEN_ARCHITECTURE.md` | 9976 | `a43eb3a09f8089766afc8cee7746d2f3df7c24a85f0a342196908b8f8e6346b1` | document |
| `docs/C3_VALIDATION_RESULTS.md` | 18805 | `3fbda419e44da15c4dc34bd6d8ec98dcf17d1c7446af683eca9c608dd0be5cd3` | document |
| `docs/C3_VISUAL_VITALITY_DIRECTIVE.md` | 8074 | `fe77908c3227c2033201a7965abc0fe10f0095c610743231ab9516471affe1ad` | document |
| `reference/canonical/QANDEEL_Q_BASE_MASTER.svg` | 3183 | `6c483aadc1492af2606539f870b878686b6c9f672c975b5e11c599d91bceaf05` | exact-byte snapshot of the approved production master |
| `review/proof/c01-conversation-token.png` | 156524 | `d06f973f8c7526c9efed862654c3ffb501b0f402c775fe7f430bf4d449bdbf75` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c02-map-token.png` | 178756 | `db4db643c26f80bdcb3a497933b66c4e11ad6bc41c7ff58d1c5e26e0471042a0` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c03-reading-token.png` | 209768 | `cd0deedaef657c85b3afa9ebfc13e560e44d63b10fd95aa5984072bc6a891f88` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c04-utility-token.png` | 104730 | `83ccd33547449936440ffd4d2c6fac9803aa9bab838b3c43b2a7f394d43a2106` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c05-map-token.png` | 178448 | `2c83e0c2d5fe4ad11aa1a574c063e7505993712a82a2aa68a2ad01ca01877031` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c06-map-token.png` | 179581 | `f7f805c082c820060b137be5ca5dfdf003c2711268853cdf4717701ae42a2f52` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c07-map-token.png` | 180242 | `f0e69f410c3711754a37a9568a32e8a6361f90318a944e525852782525e10842` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c08-map-token.png` | 179018 | `6e13ea21db24e26e09edc4d58bafb70f6d6b29ad4f8d1f6f5f82fc11a6c8e9a4` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `review/proof/c09-identity-token.png` | 50834 | `1682b00ee713ec53530a2f27f6518d681441b33cd10dc8ccbbf67bd753f3076c` | C3.12 reproduction raster — rendered from the TOKEN GRAPH |
| `tokens/appearance/dark.material.tokens.json` | 3441 | `55c56ab78358d8a3353a8794887e31a9194578ab2731f4659d7c6de42df9a367` | DTCG 2025.10 token file — AUTHORED BY C3 |
| `tokens/appearance/light.material.tokens.json` | 587 | `f2f2f8b2578abfe6ad1d5a4ab0a462967bc26ef88fad91a09092f24fddd15f65` | DTCG 2025.10 token file — AUTHORED BY C3 |
| `tokens/base/material.tokens.json` | 14376 | `bb841aa9ce194102da7a2567fd84fc95e9075e6e13805efc0c9698c4c6465928` | DTCG 2025.10 token file — AUTHORED BY C3 |
| `tokens/qandeel-living-brass.resolver.json` | 2364 | `d013dc03bccb2d246cc6313460d1776b79e9a767512a51d0dff32429c194ccb1` | DTCG 2025.10 token file — AUTHORED BY C3 |
| `tools/c3-docs.mjs` | 23548 | `df0ac758fe38f3552153231e766bd95d796d173a6d7cf30be752bb507eb43fea` | tool |
| `tools/c3-invariants.mjs` | 45334 | `ec0f7d415db8bcc7557f4349e2b4746d58fef4f9cc142490c5782edbe7cb46b8` | tool |
| `tools/c3-manifest.mjs` | 6840 | `383b7a27a8271bfbd43428fa9ef9efba25df808219cb12e7c196dda3b69ad58d` | tool |
| `tools/c3-reference.mjs` | 16793 | `337750c88cd507f00ecf3661bbe7dd46933fac6f4ed5e943387623247f2bf0aa` | tool |
| `tools/c3-render.mjs` | 4675 | `a059c58e2501f1f8cc02487a15f7f454960a46ec1c0ffdaa9efd3fcb4738c226` | tool |
| `tools/c3-repro.mjs` | 14883 | `412a3c7af5c77179dc89e1571d8a6caf2b2a66f82b9a35f75d1baecd19ca5812` | tool |
| `tools/c3-scale.mjs` | 16234 | `8b3755240d55a0a4dad4081d9b59168ac660640ab8414a9f667081d9b4f138a6` | tool |
| `tools/c3-skills.mjs` | 14321 | `eedc19074712d7a53bc9077abd7d1328106d8cccb6e8505b13a11de8f72ee295` | tool |
| `tools/c3-tokens.mjs` | 30394 | `c2914c83c6e0dce885f4dba41a3abbfaeb37cd66f6eed53f73577c2385ea0275` | tool |
| `tools/c3-validate.mjs` | 17958 | `866847dba1efff914514a887f12012483af24e2fd5bbc3e408ff4283bd38f242` | tool |
| `vendor/b4r/b4-dtcg.mjs` | 13806 | `cbe0279e263a576198ad5b6635ca6882d084ad9714330e84441c0b5a3b27db6a` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/b4r/dark.tokens.json` | 2348 | `4641f1bcbf1c12473d74ddaa77a39e5bea4314d47753d40bfded0b2e347e1112` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/b4r/increased.tokens.json` | 509 | `8a9add10c89f10582954750979477ed5391c9fec1758b053b0053de5712de311` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/b4r/light.tokens.json` | 387 | `a8ca4c0bd22093ae5f3b418403e71ed60032e17e682844dd17a0ed89c5107c99` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/b4r/semantic.tokens.json` | 4373 | `2ac7c739091446b2c4bba53cd9058ac86cac9b877c1c975cb0a781f6a490c441` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/b4r/standard.tokens.json` | 223 | `0916a7a5520e0f3696fd0c7420665bb86298171c79aef3634e0475627da6116a` | INHERITED byte-identical from I-08B3.1-B4R (frozen) |
| `vendor/c2/c2-model.mjs` | 37624 | `f2cbc731cd8c8cdb1a0c7bcd88c58b4ca86c981354fb05c03ce151dd2ee4e4f4` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/c2/c2-optics.mjs` | 6137 | `b00d8996350bfccc36835fce5087bb5b08c4b898cd21b81219917a6ee54fef59` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/c2/c2-render.mjs` | 21395 | `a691e11669e25896303be8591352e711e286164679ca8e6b0d5dc03bb2bb2b9a` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/c2/c2-ui.mjs` | 40232 | `e184383a7a013d72f41631105a46cc6aa18c0108fc89295805cf44e51c1e2d75` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/c2/color.mjs` | 8901 | `298a4b9147c6a9d55fff85367963f4c85dd4f00a7c32647d06ba76f80b30cbb5` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/c2/png.mjs` | 5851 | `b570f49d68ce49aef6bc4dbb80334f74349ed726d8d40a26215168b2df0f77e5` | INHERITED byte-identical from I-08B3.1-C2 (sealed) |
| `vendor/reference/canonical/QANDEEL_Q_BASE_MASTER.svg` | 3183 | `6c483aadc1492af2606539f870b878686b6c9f672c975b5e11c599d91bceaf05` | the canonical mark, placed where the vendored C2 model resolves it |
| `vendor/schemas/2025.10/format.json` | 3529 | `7f40fe678340b756e6464a0c20facfc29fe6ff055a202249132cc14eeafc7678` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/group.json` | 1834 | `bff8d3b46f005fad4f78b50d41fde3b2fb7303c9d246d03d3691d73112654562` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/groupOrToken.json` | 552 | `48f80d667161e61ffd12c26aab214cc994d866be9ee21b0ce1a806e02ef44ab4` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/token.json` | 11845 | `e42d903f33dd57e875bb8eef67b7401891ae50f7a22d96feb2929b795f7fef65` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/tokenType.json` | 471 | `fcc4672f4fb0346cf872f6924d8fb622609f880b5f22885a5f6c543ce6aa5794` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/border.json` | 1397 | `d316b38fbb9f7657d8ba49e0d62661c1d8159a88661af87e40fc372a12953c4e` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/color.json` | 15823 | `b721abec749fb2206cc397722861cce4f109f57d7433d2089021eaf0ce5fd501` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/cubicBezier.json` | 1792 | `b99b9896fbb99fc60f0e8ddbd82b2368cb3250b10accc7008966d5d0826b9831` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/dimension.json` | 1228 | `90e6fc121a7e7cb6697959172f93b5be05397124b6eb736ee281397e61f0e869` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/duration.json` | 1112 | `ff8490104550b44258a744901b4ba24bb36a5a1761c893bbefca785d1db1c07f` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/fontFamily.json` | 1099 | `6f8082ae06eab783f4cc2790cae259488b6b3c8677ee4b660543593b5e16e173` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/fontWeight.json` | 1010 | `ff4e05a302e2e1bdd92abc2dc4b7bd3803a4ff4d3f3d47df36603c1aeae816e2` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/gradient.json` | 1606 | `77acff5dbf54c009a5d32d3c209c79797ef0212f7bfb9485cedd910b2cd9a603` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/number.json` | 367 | `a8c0074125f0833e1cce1db28582b4d3974e1ea234bd5efbf122ca107aaa079d` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/shadow.json` | 3448 | `006827759f277106f5c2a2324f0fb597febeb8be01dbe9195d28595138f63b50` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/strokeStyle.json` | 1974 | `eee4c04cae1104853c8fd5eb742f68feadfc07d8c0204f6b19f477055c356214` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/transition.json` | 1497 | `77fcef3a44f7d817456f12cceed7c5e324a1be418f68b050e522efafd4c76c8d` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/format/values/typography.json` | 2272 | `991bb82c54166a8fba7a7d521f40e0a109fc5bdd3f5b33e2856df7669de89307` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/PROVENANCE.json` | 12132 | `4afe74d361dffe0b73ad12e75572795edb2986feced42947026fb486a848111f` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/resolver.json` | 2019 | `c405cf595461a9650495dd5093cd0a8774d2ad083bebaee616f07a2629cbd4a5` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/resolver/modifier.json` | 3610 | `110124517cea87dfa3a231b729ef88cdb7286376c8253af0a9725a286437c79d` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/resolver/resolutionOrder.json` | 5666 | `168d4948ff078fffff432ef199d40dfa8fcf30735627d40c6d39a6d9f396c2a5` | the official DTCG 2025.10 schemas, vendored with provenance |
| `vendor/schemas/2025.10/resolver/set.json` | 2756 | `ba1c318d93ae6fece70c1c97ccda3e7ff535ae14ef6012d005446e2ad350d5d4` | the official DTCG 2025.10 schemas, vendored with provenance |

