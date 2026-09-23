# I-08B3.1-D2R — MANIFEST

**87 files, 16,087,914 bytes.** Every hash below is a SHA-256 of the file as
shipped. The manifest itself is excluded, because a file cannot contain its own hash.

---

## Preflight

**15 of 15 verifiable checks hold.**

A check whose inputs are absent returns a THIRD state. Reporting it as a failure would tell a
reviewer their extraction was broken when nothing is; reporting it as a pass would claim a
verification that did not happen.

| | Check | | Detail |
|---|---|---|---|
| P1 | every required deliverable is present | **HOLDS** | 37 required, 0 missing |
| P2 | NOT ONE FONT BYTE SHIPS — tested on bytes, not on the word | **HOLDS** | 87 files; font-extension files 0; files carrying decodable font bytes 0 |
| P3 | every video was verified by decoding it back | **HOLDS** | 9 films, 0 unverified, worst mean error 0.277/255 |
| P4 | every check holds and every probe detected its planted violation | **HOLDS** | 30/30 hold; 22/22 probes detected |
| P5 | the token tree resolves and declares the version the frozen C3 tree declares | **HOLDS** | resolver version 2025.10; illumination.core aliases its expression; expression carries a hex |
| P6 | C3 invariants hold in the new namespaces: no identity alias, no forbidden name | **HOLDS** | aliases into qandeel.identity: false; the name `accent`: false |
| P7 | the settled relation passes WCAG 2.2 SC 1.4.11 on the World | **HOLDS** | #8b8982 on #101010 is 5.44:1 (the superseded literal measured 2.05:1) |
| P8 | the candidate Light meets its own requirement and improves on what it replaces | **HOLDS** | candidate 0.0201, required 0.02, diagnostic 0.0118 — 1.70x |
| P9 | I-08B3.1-D1's three scene files are vendored byte-identical | **HOLDS** | 3 inherited files, 0 changed |
| P10 | the recorded skill sources verify on this host | **HOLDS** | 86 skills enumerated; 23 claimed; 23 present; 0 whose bytes no longer match the recorded hash. Probe: an inventory pointing at absent sources returns UNVERIFIABLE rather than FAIL — true. Off this host that is the state this check reports. |
| P11 | every file the review board points at exists in this package | **HOLDS** | 24 local references, 0 missing |
| P12 | the review board is RTL Arabic with an unbroken heading outline | **HOLDS** | dir/lang present; one h1; h2 only below it, no skipped level |
| P13 | no shipped document is a stub | **HOLDS** | 13 documents, 0 under 700 bytes |
| P14 | every data file parses | **HOLDS** | 16 JSON files, 0 malformed |
| P15 | the prototype has no CSS animation, transition or keyframes, and loads the face by URL | **HOLDS** | every visual property is written imperatively from apply(t) |

---

## Files

| Path | Bytes | SHA-256 |
|---|---:|---|
| `D2_PRODUCT_OWNER_REVIEW_BOARD.html` | 14,178 | `b673d39f01efc2d1bb5b526ef53a8e82dc35be4b1512c8e78bd02f4054354639` |
| `D2R_ACCESSIBILITY.md` | 7,110 | `a81f197ed6e52a338fc945afa99284bdfebbc52593804842840ada7bddd83c84` |
| `D2R_AMBIENT_MEANING_ACTIVITY.md` | 10,569 | `ef5cd477869907bedfa9f3c94a387f3be059957733be4d5854e97eb4eda70578` |
| `D2R_CORRECTION.md` | 13,640 | `2ce4a45dd040eb7990ba96d5f9b3fb0007f41763d2d4631b97564a6cd46246e9` |
| `D2R_DESIGN_RATIONALE.md` | 11,816 | `d49c110d03598e5693f531329ac83f76e4f73773358701c31ec5952223205f58` |
| `D2R_FREEZE_CANDIDATE.md` | 11,980 | `82108d8f4e363a722a5cfe119766fb3155474ce37b74cc954b1c2c9227adaa9b` |
| `D2R_IMPLEMENTATION_BOUNDARIES.md` | 8,031 | `2091370506a7053d3ff1ff660331b55ed18858882768a012b7d32a21e2c0fc69` |
| `D2R_IMPLEMENTATION_FEASIBILITY.md` | 9,779 | `31934aeb3d1584fca099d881ee2e9d756ef77d7fcc2cfcff1ffffcfd096aedb2` |
| `D2R_METHOD.md` | 10,922 | `5fb5895ad7f3692be7d2b3e82b9851b713c6922780e1068bef92dc7e4dbedde1` |
| `D2R_MOTION_AND_REDUCED_MOTION.md` | 8,688 | `cabfc75bffbf2ab76a16d0f423ed29457fdd96e5c721aebc2bd482c16b5a055d` |
| `D2R_REFERENCE_GATE.md` | 8,861 | `e567c07fdf22ed4601f97e637f08633d9ca44d6184b04ff6e10a1776b2341ab3` |
| `D2R_SKILL_GATE.md` | 26,526 | `2d40389e5bc75467ae32d21c9bfcf427474c8a4b880f4cc5d5913475ceb2dc77` |
| `D2R_TRUTH_AUDIT.md` | 14,500 | `1777c6932d5cfcd3efef72e2728cb932b87aa5d60fe65d08749a226e746f937e` |
| `data/D2_CAPTURE_REPORT.json` | 394,939 | `0bc980d675f99e829fb9f9a676320067babb6ef0bcab9fe10029de488ab69790` |
| `data/D2_ENCODE_REPORT.json` | 2,508 | `37ff1a8188d0ea8d120726d52d6c0708b00cd0b811abe7c4437d9ca5526fbf42` |
| `data/D2_GATE_INVENTORY.json` | 56,801 | `3acfc177cf28bb3a0908a6b769a9363bd836a050085291e484c0b977ee7c3a3b` |
| `data/D2_LIGHT_DERIVATION.json` | 23,010 | `7738b9532d89c8dfd3be859115d983e44fa5744a39c02774883fb3b6159072b5` |
| `data/D2_MANIFEST.json` | 17,632 | `0eef77b13a08d31f7bb832bfbd01a8318bd65430068c2b51db8b9293363629a0` |
| `data/D2_RESOLUTION.json` | 11,122 | `4f199dbea66c297f4e1765ee31cab5de6b7e128a672d251f50d178ed26c30ab0` |
| `data/D2_STILLS_REPORT.json` | 3,078 | `4b751ef61cdd66cb83d5de4e5ee46607fb59eb92968faa2c70718ffca737f1a8` |
| `data/D2_VERIFY_RESULTS.json` | 15,253 | `839fbd3d1137ad5c0c69618b26bd503d319af4300117732d3513ea98c6362a90` |
| `frames/A/D2_A_01_PERSONAL.png` | 77,315 | `eb7026be4b88b24534b52dad43b6305a0e609c96c3d7a4007a4d183db258dd7e` |
| `frames/A/D2_A_02_PARALLAX.png` | 86,859 | `04872d621db8d0e87cefc8e9d46748166b5632d76a80dcab7d8db1eebc64461f` |
| `frames/A/D2_A_03_SHARED.png` | 66,178 | `cdf993cf0699ea67382ce848cd7c7c66f812c02115cc92ed760f7c228a30c7b1` |
| `frames/A/D2_A_04_PUBLIC.png` | 56,746 | `933f3e8299b3c2f9650608ad206e8eca98bc57dbe614d290f594d7be51aefcab` |
| `frames/B/D2_B_01_REST.png` | 99,139 | `81e891c5ce69964a16c8e8a280c43cda15c165d657ad32bde0dcddc4732083aa` |
| `frames/B/D2_B_02_EVENT.png` | 163,731 | `fe0d2492369628e7f0a44eaa9a2d2d99aa664997bc001336d148a1fd90df255e` |
| `frames/B/D2_B_03_SETTLED.png` | 103,604 | `17c866aa947c1fc1c509ed7842b5697646d16f8ec782aaf61ba10b0a0aea0c76` |
| `frames/C/D2_C_01_REST.png` | 77,315 | `eb7026be4b88b24534b52dad43b6305a0e609c96c3d7a4007a4d183db258dd7e` |
| `frames/C/D2_C_02_EVENT.png` | 114,323 | `f56ba049fcb1c96fcc7b89f2ddb8b99163d6541f92e6e9e2b39cba593b77befa` |
| `frames/C/D2_C_03_SETTLED.png` | 89,601 | `f5ebd3b1713669af395d8e1be961ea3b95679b0171e743ed773d920beb8a3033` |
| `frames/contact/D2_A_CONTACT_SHEET.png` | 131,802 | `13a5778130c80c2f9372498048864881b824d6e58709d949443c6593ec53ced3` |
| `frames/contact/D2_B_CONTACT_SHEET.png` | 168,096 | `b53bb92fbd65a414ad13b3ee05a2c660ad20a1e6ddcaa2d2973c6393f259cae1` |
| `frames/contact/D2_C_CONTACT_SHEET.png` | 111,236 | `afdc946afd234fed0f7f4244011d399213c0506439f55ef0617d92527ed31af0` |
| `frames/contact/D2_D_CONTACT_SHEET.png` | 102,547 | `d0da33ac9455a60e00b1b0cfa7ac0f972416a526b5891cef59e82ff6d3d8bebf` |
| `frames/D/D2_D_01_REST.png` | 77,315 | `eb7026be4b88b24534b52dad43b6305a0e609c96c3d7a4007a4d183db258dd7e` |
| `frames/D/D2_D_02_EVENT.png` | 117,768 | `be343254542939197e04cb286cfd4b3ceb595be65ef69f9ed88ce1f26126508d` |
| `frames/D/D2_D_03_SETTLED.png` | 84,510 | `8a964061317085cc83722c183afdb4029632065b1d64fb0cc199c0609c68fb4c` |
| `frames/proof/D2_COHERENCE_GRID.png` | 360,134 | `da3b314496588e612c8518cc069527b851e8b53711b50647f2db2a3a1dde2fd5` |
| `frames/proof/D2_LIGHT_SEPARATION.png` | 11,739 | `883b8325bd685f04daaa2f1cc30cfe17f3e0642c584da7101b35d76253f585ab` |
| `frames/proof/D2_REDUCED_MOTION_PAIRS.png` | 279,469 | `e80b1a6b7dee87a4cefe10d55a7b0dbcc17713167bd43eefe76f0e58a40b25ad` |
| `frames/proof/D2_THREE_WORLDS.png` | 80,671 | `5b2b958f6b2f32a47c9db5f2e1ceaa3187aac71e05e1c5dfeac3bbd8c8fd94cb` |
| `prototypes/D2_LIGHT_SYSTEM.html` | 231,528 | `e6c760958c8ac89c5b85b2b1108a2f971134cf36c946cd16ffbacc8c036359db` |
| `README.md` | 8,091 | `2751a7c106dc7372dc21a2c1fee81d322057e68d6ae907fea1aa3b578a67e09f` |
| `source/scene/d2-connection.mjs` | 3,932 | `debb4a0a7327c97e16ad7644262b25fa20a052288c6fad5c845f8f31d7db37b7` |
| `source/scene/d2-events.mjs` | 15,763 | `41043c6b23865f9105101d0234a85a225431789947021d68f5a06e1bd00de6f7` |
| `source/scene/d2-foundation.mjs` | 13,428 | `cdcd403ffea7e9bf218b4f37eea71b356c0fdc5c26e4af8925e7de61956133b8` |
| `source/scene/d2-render.mjs` | 16,228 | `0c97580c021eef76cbabfa82de601594d1526d0178a9b27f31d26bcf8da548b7` |
| `source/scene/d2-world.mjs` | 17,062 | `49ec36fb8e1bde33cf4430eb0fe24c15051ba55d387e4203f8033ab4e5f3f597` |
| `source/tools/d2-board.mjs` | 13,725 | `711404b2bf493c68a5a01e6b9cb7fdb873a8fc347db86374479a5731ab745146` |
| `source/tools/d2-build.mjs` | 39,028 | `f660957f2f8ece1bfa01eff274733f6d2e3546bd11acdf3ce708150571b5b7fa` |
| `source/tools/d2-capture.mjs` | 10,687 | `4099d6b7ae7ca450cd0d2b4898d5cd9095691ad04502bcaf3bb4e3352d8333f2` |
| `source/tools/d2-cdp.mjs` | 7,402 | `8bcd3977de0c07772e2fac2f3a6c9e61169e42b6ed1be7ff76375a8ebd6ac7a9` |
| `source/tools/d2-chrome.mjs` | 7,383 | `a568c7fd0995eaef76f4d55755177ae6b6681683b1462a63f416feebbb363751` |
| `source/tools/d2-encode.mjs` | 8,064 | `c2fce9d2f6836455d452506eca80c9e8290615d4bd2928d1389bebf40abe2685` |
| `source/tools/d2-font.mjs` | 5,058 | `4aa067f51ee68cbea9d2ee891db863c39182b811ddece3227d0f85350fdd9144` |
| `source/tools/d2-gates.mjs` | 41,024 | `d0c9c31b435018af5907b2790d2873f48e67646c5e164f9d213addb858a60184` |
| `source/tools/d2-lightsearch.mjs` | 19,848 | `19afe364d9f4f3ff436ac92d88e2b09687459fa2da087571351521cee90f150b` |
| `source/tools/d2-main.mjs` | 965 | `b732e754b58c30bfa043a6afe136b8f9bb0e1fb2e63fecbdd36662a241b0ec80` |
| `source/tools/d2-manifest.mjs` | 15,472 | `c75c404e5260a6db737aed5606683d7b5f3c862bbf0c65152103d67fc915f20a` |
| `source/tools/d2-stills.mjs` | 9,192 | `00eab9abdd44c155231c5738bc68614ee39204d1ba30bd4b9c3372e2cfa3a0cb` |
| `source/tools/d2-tokens.mjs` | 32,398 | `0149ff6678d709ac5fb672489b0aefc8902680c2f004c7cbc18296498067c772` |
| `source/tools/d2-verify.mjs` | 65,857 | `2a0f2e9ff0d2d619a40eefbfc5acd257c31990f660d88384c8a386a8542dd7a3` |
| `source/tools/d2-zip.mjs` | 7,374 | `f2fc1cd2cbbdeea9fcc8009c520a0e7852cb11905eababb853bc2cfdac539288` |
| `source/vendor/c3/b4r/dark.tokens.json` | 2,348 | `4641f1bcbf1c12473d74ddaa77a39e5bea4314d47753d40bfded0b2e347e1112` |
| `source/vendor/c3/b4r/semantic.tokens.json` | 4,373 | `2ac7c739091446b2c4bba53cd9058ac86cac9b877c1c975cb0a781f6a490c441` |
| `source/vendor/c3/tokens/appearance/dark.material.tokens.json` | 3,441 | `55c56ab78358d8a3353a8794887e31a9194578ab2731f4659d7c6de42df9a367` |
| `source/vendor/c3/tokens/base/material.tokens.json` | 14,376 | `bb841aa9ce194102da7a2567fd84fc95e9075e6e13805efc0c9698c4c6465928` |
| `source/vendor/c3/tokens/qandeel-living-brass.resolver.json` | 2,364 | `d013dc03bccb2d246cc6313460d1776b79e9a767512a51d0dff32429c194ccb1` |
| `source/vendor/color.mjs` | 8,901 | `298a4b9147c6a9d55fff85367963f4c85dd4f00a7c32647d06ba76f80b30cbb5` |
| `source/vendor/d1/d1-arrivals.mjs` | 17,684 | `915ff97618bb40cc4e04d4d0c6e42dcf4f2bd9178cd39cbafc690a74a4b19efd` |
| `source/vendor/d1/d1-render.mjs` | 21,785 | `e1ea2960e19d36eb3547b135d3e7a36eb0855b46f065d4d666fabde238d20940` |
| `source/vendor/d1/d1-scene.mjs` | 27,642 | `841dea14f60dde91ac3fd903afdbb64e56300d3327f30902a7ba029d0d7e0e46` |
| `source/vendor/png.mjs` | 5,851 | `b570f49d68ce49aef6bc4dbb80334f74349ed726d8d40a26215168b2df0f77e5` |
| `source/vendor/QANDEEL_Q_BASE_MASTER.svg` | 3,183 | `6c483aadc1492af2606539f870b878686b6c9f672c975b5e11c599d91bceaf05` |
| `tokens/appearance/dark.illumination.tokens.json` | 3,794 | `688bad2f79ac7b22fdefe4b94f4c07a08b5c249bdcb84327e9df2ff82a565157` |
| `tokens/base/illumination.tokens.json` | 30,299 | `2d32bf8987016d7d21b226b4c9111b5e38f8786397badc37dd4cd9655cf230b4` |
| `tokens/qandeel-light.resolver.json` | 1,720 | `3e40342ede17d0370fa3c1461439d514bbc36eb71e1253273e19c9e8618f88bc` |
| `video/D2_A_AMBIENT_WORLD_FIELD.mp4` | 1,206,762 | `f81db7f1bde2d995a7afd76bbbd919768b2894486052f9e7746bf6920d538cf1` |
| `video/D2_B_CONNECTION_INHERITED.mp4` | 1,145,538 | `94da988a6effe2da09929766f0bc0179e19b301036ba59033bb1409f01bb44b3` |
| `video/D2_C_PATTERN_CRYSTALLIZATION.mp4` | 967,953 | `fd0e3a538c2544963d6a549f64826b96519b97071959028f27f858cb4319920b` |
| `video/D2_COHERENCE_FOUR_CATEGORIES.mp4` | 4,328,168 | `f766ee31f17d94d2d2e8e76c50e8e624a47df8500ce076be1f2c325f90a29cbf` |
| `video/D2_D_INSIGHT_EMERGENCE.mp4` | 827,011 | `85cb8c9955b91d5e56438949112fc7458900cf5e090b0684e13fe1df4d1a386a` |
| `video/D2_RM_A_AMBIENT_WORLD_FIELD.mp4` | 1,198,661 | `0f66e9a59efbc2342f4ac023699ef59ed8db7b916f74acf158189ee5d3db3e4d` |
| `video/D2_RM_B_CONNECTION_INHERITED.mp4` | 815,251 | `c631c784beb8b498d56d2fbf0f593735f6c5edad9506f3e2cb423bececc30616` |
| `video/D2_RM_C_PATTERN_CRYSTALLIZATION.mp4` | 960,730 | `52c1971233f7fa5aa457b476e6c21a6cb78fa22caa7ca1413846bdc06c1cf278` |
| `video/D2_RM_D_INSIGHT_EMERGENCE.mp4` | 759,529 | `d0d0a6ea27de8f316b5df6fb661fb5ecd2e7e016128d903959e27e03c4999c57` |
