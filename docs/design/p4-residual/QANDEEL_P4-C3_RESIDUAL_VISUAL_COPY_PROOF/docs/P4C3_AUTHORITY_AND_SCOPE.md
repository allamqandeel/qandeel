# P4-C3 — Authority and scope

## 1. Repository truth at the start

| | |
|---|---|
| Repository | `allamqandeel/qandeel` |
| PR | #280 — Draft, Open, Unmerged (verified at start and by C-SCOPE-4) |
| Branch | `design/p4-c-shell-chrome-integrated-decision-proof` |
| Starting head | `0b2703ef35cbad724078926b645d2d216c860749`. The local checkout was a clean ancestor (`5b367d7`) and fast-forwarded to the remote PR head. No divergence |
| P4 | **ACTIVE — NOT CLOSED / NOT FROZEN**. All Product Owner decision rows are resolved by P4-C1 and P4-C2 |
| APP-OPS-01 | candidate, not frozen. Untouched by P4-C3 |

## 2. Authorities read, and what each binds here

| Authority | Sections | What P4-C3 takes from it |
|---|---|---|
| P4-C2 | §1–§5, §7 | I-08B2.5 is final brand authority (bytes unchanged, 48 dp); the static launch closes in P4 and the lantern is in v1 but entirely a standalone later task; Voice **Split** (non-signal visuals here, signal visuals gated); the copy disposition (what P4 closes, what the audit takes, what stays runtime-gated); English casing QANDEEL |
| P4-C1 | §1–§5 | S-B + U-A + Q-A + SW-3; «سياق الكلام» surface retired; no persistent shell Q — the normal opener is a Q identity moment |
| P4 Read First, Decision Queue, Census, Carry-Forward | — | P4-GAP-018, -019, -021, -022, -028, -030, -031, -033, -034, -035 and the lantern carry-forward |
| G1.1 closure | §1–§3, §5 | speaker sides; Conversation / Analysis names; the frozen Arabic opener; `UTTERANCE`; the Replay noun left editable |
| G1.2 closure | §1–§8 | Writing / Voice Note Conversation-first; Live Call Analysis-first and continuous; no normal-state prose; one assistive channel; call visuals and strings not frozen; `QAN-BL-VOICE-01` |
| G3 closure | §C, §F, §G | the Analysis is the dark place; the §G open-copy row that P4 closes now |
| P1 closure | §6, §8.1, §10, §11.3–§11.4, §12 | Public ID one-change law and warning obligation; Settings groups (placement only); «فهم قنديل»; the four confidence concepts; the appearance preference |
| P2 closure | §4–§11 | the signature family, Call Rail A, End Call at 27 px, the utility sourcing, Calm State Morphing, direction by meaning, 44 pt, no fake speaking signal |
| P3 closure | §9, §10, §11, §12, §13, §16, §17 | the frozen P3 surfaces, the copy boundary, the call-safe strip law, permission education (audit), Quiet Hours re-evaluation |
| I-08A4 | §8, §9, §10 | frozen Arabic / English Product names, including «العالم العام» / Public World and the earlier «عرض الجلسة» / Session Replay row (since P4-C3R superseded, for that Product-facing name only, by «إعادة العرض» / Replay; the bytes stay preserved) |
| VI-01 | Terminology Matrix V01–V07; Foundation §3, §4, §7, §14 | register tiers, gender-neutral technique, the English "context" / "live" rule, voice strings `PROVISIONAL / PHASE VII` |
| T-08 `product-copy.ts` | header, packs | frozen Return / temporal wording, numerals, register |
| T-14 `product-sign-in-copy.ts`; `mobile-product-sign-in-gateway-v1.md` §7 | — | "Sign in" / «تسجيل الدخول»; the gateway's deliberately brand-free boundary |
| C3 | Expressive Headroom §4 | the lantern as an exceptional gateway identity object — not designed here |
| I-08B2.5 brand | masters, Android adaptive layers | the Q master (opener) and the icon bytes (Android splash) |
| Canonical Artifact Index; G1.2 and G3.2 preserved proofs; P2-A, P3-A, P4-C packages | — | tooling patterns and byte-exact inputs |

## 3. Consumed byte-exact (never redrawn)

- P2-A: `sig.mjs`, `utility.mjs` + `vendor/utility`, `machines.mjs`, `tokens.mjs` + `vendor/tokens`, Estedad v8.5,
  `lib/cdp.mjs`, `lib/server.mjs`;
- P3-A: `p3glyphs.mjs` (Open Ledger);
- P4-C: `qmark.mjs`, `lib/sheet.mjs`;
- I-08B2.5: `QANDEEL_Q_BASE_MASTER.svg`, the Android adaptive foreground (xxxhdpi), background and `ic_launcher.xml`,
  and the iOS 180 px icon;
- G3.2: the reviewed prototype, sha `10611f35…`, in a frame.

`source/PROVENANCE.json` records every origin and hash. C-PROV-1 and C-PROV-2 re-verify them on every run.

**Runtime-only interventions in G3.2** (no byte changed): its copy object is substituted with the proposed core copy; its
pre-P2 call line and level trace, its pre-P2 switcher and its second assistive call channel are hidden and made inert;
P2 Call Rail A and the SW-3 switcher stand in their measured boxes.

## 4. In scope

1. Static launch → system handoff proof (iOS, Android) **up to the boundary**.
2. Non-signal Voice: the Voice Note turn, the finished-call record, recording / sent states, and the Live Call
   composition.
3. P4-owned bilingual copy: core Conversation / Analysis / Replay / Timeline / Live-edge; the English normal opener;
   confidence words; Settings group names; the Public ID warning; P3 residual copy on frozen P3 surfaces.

## 5. Deliberately out of scope

- **Lantern (hard stop):** no research, design, redraw, storyboard, timing, Q-reveal, technology choice or substitute
  composition. The first app-owned frame is left empty on purpose.
- Production runtime, `apps/`, schema, migrations, dependencies, providers, the native call stack.
- The full Settings, Understanding, sign-up, first-use Welcome, Shared / Public and Matching surfaces (P4-C2 §3 → audit).
- Sign-in failure / Login ID help, VI-01 residue, Matching copy, the permission-education sheet (P4-C2 §5 → audit).
- Voice / call strings and any signal-bearing Voice visual (`QAN-BL-VOICE-01`).
- Closing P4, freezing APP-OPS-01, starting the End-to-End audit, merging PR #280.
