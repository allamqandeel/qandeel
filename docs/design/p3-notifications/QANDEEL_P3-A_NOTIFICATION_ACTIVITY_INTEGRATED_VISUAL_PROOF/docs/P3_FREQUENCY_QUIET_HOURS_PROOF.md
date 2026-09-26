# P3-A — Frequency ceilings, Quiet Hours and Snooze (proof)

**Status:** `P3-A EVIDENCE — NOT FROZEN`. Evidence: boards 12 and 13, clip M06, checks C-QUIET-1…4 and C-FREQ-1…10.
Source: `source/src/model.mjs` (`CEILINGS`, `budgetVerdict`, `decide`, `reevaluateAtQuietEnd`, `runTrace`) and the
fixtures `OVERNIGHT` and `WEEK` in `source/src/fixtures.mjs`.

## 1. The numbers (Product Owner v1 safety ceilings, task §14 — ceilings, never quotas)

| Ceiling | Value | Counted over |
|---|---|---|
| ordinary interrupting Push, all ordinary categories combined | **4 / rolling 24 h** and **12 / rolling 7 d** | every Push except the two exceptions |
| Proactive QANDEEL | **1 / rolling 24 h** and **3 / rolling 7 d** | Proactive Pushes (also inside the ordinary budget) |
| same proactive thread after no engagement | **not before 48 h** | per thread |
| a third interruption on the same subject | requires **new meaningful context** + a new Gate evaluation | per thread |
| Public Discovery | **1 / rolling 7 d**, opt-in, first candidate for suppression | Discovery Pushes |
| outside ordinary competition | the exact-time reminder the user asked for; a genuinely critical security / account event | still bound by privacy, authority and OS permission |

A refused candidate is **downgraded, never queued to spend budget later**: an ordinary one stays a truthful Activity
item; a Proactive one waits for the next conversation (a D12 surface); a Discovery one is suppressed.

**Ceiling ≠ quota.** The model has no code path that turns unused budget into a candidate (`runTrace([])` sends
nothing — C-FREQ-8). The Product shows no meter, no remaining count, nothing that implies a reason to notify.

## 2. The seven-day trace (board 13) — every outcome against a separately stated expectation

20 candidates, 20 / 20 as expected (C-FREQ-10). What it proves: the 5th ordinary Push in 24 h refused (W05); the
13th in 7 d refused (W19, after exactly 12); a 2nd Proactive inside 24 h refused (W08); the same thread at 25.5 h
refused and at 48.5 h allowed (W09, W10); the third interruption refused without new context (W17) and allowed with it
(W18, the 3rd Proactive of the week); a 2nd Discovery in 7 d suppressed (W14); the reminder and the critical event
delivered outside the ceiling even when the week's ordinary budget is spent (W06, W20).

A separate micro-trace isolates the Proactive 1 / 24 h rule: a second Proactive 6 h after the first, with the ordinary
budget free, is refused for `proactive-24h` alone (C-FREQ-3; planted defect D7 flips it).

## 3. Quiet Hours (P3-L) and Snooze

- **Default ON, 23:00 → 08:00 device-local**; editable; can be turned off (C-QUIET-1).
- During them, only the two frozen exceptions may interrupt (C-QUIET-2; planted defect D14 widens them and is caught).
  Ordinary Proactive QANDEEL, Shared, Public, Introductions and relationship follow-ups **wait**.
- Snooze (1 h / 8 h / 24 h / Custom) and Quiet Hours affect **interruption only**: nothing is deleted, truth and
  authority are unchanged, and every item is in Activity (D37).

## 4. The end of Quiet Hours — no morning dump (P3-M)

Five candidates arrive overnight (fixture `OVERNIGHT`, board 12, clip M06):

| | arrives | on arrival | at 08:00 |
|---|---|---|---|
| Q1 Shared reply, «رحلة الصيف» | 23:40 | waits (Quiet Hours) | **Activity + mark** — meaningful, not timely now |
| Q2 Public reaction | 00:55 | Activity only (ambient) | — |
| Q3 Shared vote closing at 07:00 | 02:10 | waits | **stale** — its window closed; not sent (D59) |
| Q4 Proactive QANDEEL (Thursday's presentation at 10:30) | 03:30 | waits | **Push** — the Gate still says "useful now" |
| Q5 critical security (new sign-in) | 06:40 | **Push now** — the exception | — |

Two interruptions instead of five, and only one at 08:00. Q1 and Q3 share a World but differ in kind, so they are not
merged; nothing crosses Worlds (C-QUIET-4).

**Proof interpretation (flagged):** the Product Owner's rule is "re-evaluate every candidate; do not dump". The model
reads it as: the 08:00 boundary is not itself a reason to interrupt, so a waiting candidate earns a Push then only if
its value is **still timely now** (Class ≤ 2, or a Proactive candidate whose Gate says "useful now"); everything else
becomes Activity, stale or suppressed, and the ordinary ceilings still apply. No new number is introduced.
