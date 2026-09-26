# P3-A — Implementation feasibility (not an implementation task)

**Status:** `P3-A NOTE — CHOOSES NO PROVIDER, ADDS NO DEPENDENCY, DEFINES NO SCHEMA, CLAIMS NO READINESS`.

This note tells a later, separately scoped task where the seams are. It authorizes nothing (roadmap §1 rule 2).

## 1. What exists today

On `main`, no notification runtime, Activity projection, Push transport, device registration, channel or category
exists; `apps/mobile/` has no notification code; the final P2 icons are not in production either (P2 closure §14).

## 2. Likely future seams (descriptive only)

| Concern | Seam the proof suggests | What it would need |
|---|---|---|
| Product decision | one pure decision function per candidate (`decide`), fed by the event, the user's settings, recent Push evidence and the foreground context | a server-side home, owned by the future notification orchestration task; I-08N-01 §19's flow |
| Ceilings | rolling-window counts over **per-user Push evidence**, not over events | durable Push evidence per user; D53's separation of user-level attention and per-device delivery evidence |
| Quiet Hours end | a re-evaluation pass at the boundary, not a queue flush | a scheduler; semantic expiry per candidate (D59) |
| Disclosure | the bounded projection built per level from ONE event | the renderer receives only that projection (§10) |
| Activity | a user-facing projection with attention state per item | storage and retention by Product meaning (D32) — not designed here |
| Attention Mark / strip | foreground presentation from the same decision | knowledge of "where the user is" and "is a Live Call active" (on either surface, foreground or background) — the latter is a required property of `QAN-BL-VOICE-01` (G3 §D); the call-safe strip needs the Analysis chrome row's measured free slot |
| Platform | APNs / FCM delivery; iOS categories and interruption levels; Android channels and Lock Screen visibility; the permission request | the platform owns the prompt, the frame, Focus / DND, channel importance and entitlements (P3_PLATFORM_REFERENCE_GATE.md) |
| Proactive Gate under Reduce | the Gate's own finding whether a candidate is strong enough to interrupt under Reduce | the proof states it as a fixture boolean (`reduceEligible`); a production Gate decides it — the proof defines no score, weight, threshold or field |
| Icons | the Open Ledger glyph and the Introductions source mark (Open Link) are SVG path data in P2's grammar | the same production vector path P2 §14 describes (no new dependency beyond what P2 already names) |

## 3. Constraints to respect

- Product class ≠ OS level; Critical Alerts need an Apple entitlement and are not assumed; Android channel importance
  is the user's after creation. Board 14's mapping is an example only.
- iOS spends its one system prompt on the first request; Android 13+ lets the app pick the moment. Both fit the
  contextual flow.
- The OS may hide more than QANDEEL's level; QANDEEL must never rely on that to protect content.

## 4. What cannot be truthfully simulated in a browser proof

Real delivery / presented / seen evidence (D41, D56), multi-device de-duplication (D53), background execution and
retry (D54, D55), the platform's own notification UI, Focus modes, the real Lock Screen, haptics, screen readers,
device Reduce Motion / Increase Contrast, and touch latency. The proof uses fixtures for all of these and says so.

## 5. Carried to the P3 closure (not admitted here)

The later canonical P3 closure will have to disposition, under BG-06: the production realization itself; the device
gates above; the proof interpretations of the 08:00 rule and of the one-strip tie-break on re-evaluation (the
longest-waiting of equal-class candidates); the proof-context field `view` (where the user is looking), which a
production design will have to realize from real navigation state; and the copy still marked PROOF. Reduce, critical
security during a Live Call and the entry's absence from the Analysis chrome were answered in the refinement; Open
Link, the absence of any ordinary strip in the Analysis (deferral + re-evaluation on exit), the Replay-slot occlusion
for the two call-safe cases only, and the call-safe strip's lack of Direct Entry were answered in the final
micro-refinement. This proof admits no backlog item.
