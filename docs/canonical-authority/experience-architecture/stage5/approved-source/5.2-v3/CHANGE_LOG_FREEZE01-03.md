# Stage 5.2 — Change Log, Final Freeze Corrections FREEZE-01…FREEZE-03 (v3)

Basis: `QANDEEL_STAGE5_2_FINAL_FREEZE_CORRECTIONS.md` (verdict: TARGETED FREEZE CORRECTION REQUIRED; v2 structurally accepted; REV-01…REV-08 confirmed applied). v2 is left intact as the reviewed artifact. Research, grammar, the 20-scenario suite and the boards were **not** rebuilt; only the places below changed.

| FREEZE | Correction | Package sections changed | Matrix / scenarios / boards changed |
|--------|------------|--------------------------|--------------------------------------|
| **FREEZE-01** | Every `RH` restoration path obeys `RestoreTemporal(entry) := PINNED(entry.capturedTC)`; `capturedTM` is provenance only; only P4 (or P5's temporal part) establishes `FOLLOW_LIVE` | §2.7 (entries now carry `capturedTC`/`capturedTM`; canonical restoration rule added), §3.2 P8 (rewritten; adversarial example `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back = PINNED(30)`), §7.1 Back row, §8.1 F-05, §9 MUST 10–11 / MUST NOT 19, §13, App. Q11 | §6 Back One Step row + invariant 7; §8 S-11 rewritten to the required example; Board A: P8 strip, panel 6 Back row, new P8 matrix row; Board B: S-11 cell now shows `PINNED(12)` (LH 44) → `PINNED(30)` |
| **FREEZE-02** | Assistive announcements / nonvisual chrome obey the no-hindsight firewall; every "moment X of N" example removed; safe forms stated | §1.6 implication, §3.3 announced-value paragraph (rewritten), §8.1 F-06, §9 MUST 17 / MUST NOT 9 | §8 S-19 extended to nonvisual count leakage; Board A panel 7 caption ("4 of 9" removed, firewall stated); Board B S-19 caption |
| **FREEZE-03** | P3a uniqueness is a settle-time guard: `UniqueLocatable(x, K(TC))` at settle — 1 → once, 0 → refuse, >1 → explicit Stage 4.3 choice; `FOLLOW_LIVE` re-evaluates against then-current `K(LH)`; no stale grant-time result | §3.2 P3a (rewritten), §5.3, §5.4, §8.1 F-07, §9 MUST 6–7 / MUST NOT 21, App. Q10 | §6 P3a cell + invariant 8; §8 S-17 extended with the `LIVE_EDGE` gain/loss-of-loci case; Board A: P3 strip, composite matrix row; Board B: S-17 cell now shows one locus at grant → two at settle → explicit choice, no camera move |

## Confirmed unchanged
REV-01…REV-08 in full; current-Session-only domain; `Moment(m)` vs `LIVE_EDGE`; Model C; `PTC ∉ S`; commit at gesture end / activation; temporal intent ≠ spatial intent; one-shot entitlement; no persistent follow; P5 locatability guard; spatial input cancels Preview; no future structural ticks/labels/counts after `TC`; knowledge-gated suspended-`IF` naming; guarded symbolic "go to when this becomes available"; conditional `SP` address rule; atomic `RH` grouping; P7 always `PINNED(capturedTC)`. `S` has no new member. No primitive added or removed.

## OPEN items
Unchanged from v2: OPEN-02, OPEN-06, OPEN-08, OPEN-09, OPEN-10, OPEN-11, OPEN-12 remain; OPEN-01, -03, -04, -05, -07 remain closed. FREEZE-01…03 opened nothing and closed nothing.

## Board file names
`boards/S5.2_A_Timeline_Navigation_Grammar_FREEZE_CANDIDATE.png`, `boards/S5.2_B_Temporal_Interaction_Adversarial_Stress_FREEZE_CANDIDATE.png`; generators alongside.
