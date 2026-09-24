# QANDEEL — Stage 5.2 Freeze Candidate Package v3

**Status:** FREEZE CANDIDATE for **final Product / Experience / Architecture sign-off**. **Not frozen** — only the sign-off may freeze it.
**Date:** 2026-09-02
**Track:** QANDEEL Living Analysis Map. Binding authority: `QANDEEL_NAVIGATION_CANONICAL_CHECKPOINT_v1` (Stages 0–4, frozen) + the Stage 5.1 contract carried in `QANDEEL_STAGE5_2_CLAUDE_HANDOFF.md` (frozen).
**Lineage:** v1 candidate → Architecture Review (REV-01…08) → v2 revised candidate → Final Architecture Freeze Review (v2 structurally accepted; FREEZE-01…03 required) → **v3**. v1 and v2 are left intact.

## What this is

Stage 5.2 — **Timeline Navigation Grammar**: which user actions constitute temporal navigation, what each means, when a temporal selection is preview vs committed, and when temporal intent may legitimately include spatial locate intent. Research + formal grammar + transition model + adversarial proofs. **No** code, **no** repository change, **no** Replay, **no** Timeline styling.

## What changed in v3 (full map in `CHANGE_LOG_FREEZE01-03.md`)

- **FREEZE-01** Every `RH` restoration — P7 Exact Return, P8 Back One Step, P8 over a P3a/P5 composite — restores `PINNED(entry.capturedTC)`; `capturedTM` is provenance only; only P4 (or P5's temporal part) establishes `FOLLOW_LIVE`. Proof: `FOLLOW_LIVE@30 → PINNED(12) → LH 44 → Back = PINNED(30)`, not `FOLLOW_LIVE@44`.
- **FREEZE-02** Assistive announcements and nonvisual chrome obey the same no-hindsight firewall as the Track: no total count, no "x of N" with future `N`, no future names while pinned. Every "moment 4 of 9" example removed.
- **FREEZE-03** P3a's uniqueness is a settle-time guard: `UniqueLocatable(x, K(TC))` at settle — one locus → execute once; zero → refuse; more than one → explicit Stage 4.3 choice; `FOLLOW_LIVE` re-evaluates against then-current `K(LH)`; no stale grant-time result ever moves the camera.

**Explicit confirmation:** REV-01…REV-08 and all other accepted v2 direction are unchanged. No primitive, state member, OPEN item or scenario was added or removed.

## Still-open (unchanged from v2)
OPEN-02, OPEN-06 (in-session), OPEN-08 (in-session granularity), OPEN-09, OPEN-10, OPEN-11 (Track disclosure classes), OPEN-12 (Live-Edge vs latest-Moment affordance). Closed: OPEN-01, -03, -04, -05, -07.

## Read in this order

1. `CHANGE_LOG_FREEZE01-03.md` — verify each correction landed where the review said.
2. `STAGE5_2_FREEZE_CANDIDATE_PACKAGE.md` — the full package (`[REV-nn]` / `[FREEZE-nn]` tags mark changed clauses).
3. `boards/S5.2_A_Timeline_Navigation_Grammar_FREEZE_CANDIDATE.png`
4. `boards/S5.2_B_Temporal_Interaction_Adversarial_Stress_FREEZE_CANDIDATE.png`
5. `IMAGE_INDEX.md` · `CHANGE_LOG_REV01-08.md` (v2 history)

## Scaffolding disclaimer

The boards draw the frozen Organic Living Field schematically (fixed Home loci, Session footprints, one persistent world, a current-session Track) so that interaction truth can be shown. Every shape, colour, glyph, layout, control placement and copy in them is scaffolding. Nothing visual is proposed.

## Upstream preserved

Stages 0–4 untouched. Stage 5.1 §1–§7 verbatim; its exact-viewpoint rule now governs every restoration path. `S = { LH, LF, TM, TC, K(TC), IF, MC, RH }` has no new member.
