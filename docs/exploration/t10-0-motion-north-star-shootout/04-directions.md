# T-10.0 — The three directions, as built

Source of truth: `apps/mobile/src/motion-lab/motion/profiles.ts`. Every value is a hypothesis.
What is shared by all three is the truth substrate and the residual-camera model; what differs is
the choreography that resolves the residual and the presence of entitled objects.

## Shared substrate (identical across A, B, C)

- The real canonical store with the T-04 / T-06 / T-07 authorities; the real Map derivation,
  placement and freshness rule; T-06's temporal layer; T-08's chrome; one fixture world.
- `screen(p) = c + zoom · (p + t − c)`: the plane carries a residual translation `t` and zoom about
  the centre. A finger writes `t` 1:1; a canonical camera change re-bases the residual so the frame
  is preserved (`zoom' = zoom / k`, `t' = k · (t + d)`), then the direction resolves it to rest.
- One canonical `PAN` per interaction, committed where the plane rests (after momentum, or when a
  Product act interrupts the momentum). A cancelled active drag springs back and commits nothing.
- Temporal departures are removed on the next frame in every direction. Only depth departures may
  play an exit.
- Reduced motion (all directions): x/y/z travel → cut + a short opacity resolve; zoom → cut +
  fade; disclosure and temporal arrivals → fade in place; no stagger; no field; shorter momentum;
  Ignition → opacity-only ring. Gesture tracking untouched.

## A — Continuous Resolve

| Aspect | Value |
| --- | --- |
| Axis | Camera continuity. The world is a stable place; disclosure fades where it belongs. |
| Pan release | decay 0.996; cancelled drag springs back (320 ms, ratio 1) |
| Zoom | spring 460 ms, ratio 1, no delay |
| Travel | spring 380 ms + 0.28 ms/pt, max 560 ms, ratio 1, no velocity carry; never resolves-in-place |
| Disclosure arrival | in place: opacity 220 ms + size 0.9→1 (timing 220 ms), no stagger; exit fade 120 ms |
| Temporal arrival | in place: opacity 160 ms; exit instant |
| Go Live + Locate | spatial half after 140 ms |
| Field | none |
| Ignition | ring, 420 ms |
| Exact Return lock | 240 ms |

Premium test: precision. Risk: too safe / Apple-like.

## B — Semantic Unfolding

| Aspect | Value |
| --- | --- |
| Axis | Disclosure. Detail unfolds from the locus that hosts it, in disclosure order; the camera follows meaning. |
| Pan release | decay 0.993 (shorter momentum); cancel returns with a 260 ms timing |
| Zoom | timing 300 ms ease-out, **delayed 90 ms** so the unfolding leads |
| Travel | timing 280 ms + 0.12 ms/pt, max 380 ms; **beyond 1.25 viewport diagonals the flight is replaced by a resolve-in-place** (opacity 0.3 → 1 over 240 ms) — the direct test of "nothing teleports" against "meaning resolves" |
| Disclosure arrival | from the host Home: slide + size 0.6→1 (timing 340 ms), opacity 220 ms, **36 ms stagger** by disclosure ordinal; exit folds back into the host over 180 ms |
| Temporal arrival | from the host: timing 260 ms, 28 ms stagger; exit instant |
| Go Live + Locate | spatial half after 260 ms (meaning first) |
| Field | none |
| Ignition | bloom (brass disc + ring), 560 ms — the strongest test |
| Exact Return lock | 280 ms |

Premium test: analysis feels alive without particles. Risk: implying relationships or certainty;
a resolve-in-place is a cut, which some readers will see as a teleport.

## C — Field Resonance

| Aspect | Value |
| --- | --- |
| Axis | The field. Momentum preserved, springs carry the hand's velocity, nearby presentation responds a little. |
| Pan release | decay 0.998 (longest momentum); cancel springs back (360 ms, 0.85, carries velocity) |
| Zoom | spring 540 ms, ratio 0.86 |
| Travel | spring 520 ms + 0.18 ms/pt, max 640 ms, ratio 0.82, **carries the plane's velocity**; arrival breath +6 % on nodes |
| Disclosure arrival | from the host: spring 520 ms, ratio 0.72 (overshoots), 24 ms stagger; exit springs back 220 ms |
| Temporal arrival | in place: size spring 420 ms, ratio 0.74; exit instant |
| Go Live + Locate | spatial half after 80 ms |
| Field | node size follows plane speed (+5 % per 1000 pt/s, capped) |
| Ignition | ring + **ripple**: neighbours within 120 pt breathe +6 %, delayed by distance |
| Exact Return lock | 260 ms |

Premium test: a living semantic world rather than a node canvas. Risk: bouncy, overactive; the
ripple reads as relationship.

## What was NOT varied on purpose

- Colour, typography, node geometry, the register, tethers: all neutral placeholders (VI-03 is
  open). A direction is a way of moving, not a look.
- T-06's strip motion and T-08's chrome: production surfaces, unchanged.
- The commit boundary and every Product rule: identical in all three.
